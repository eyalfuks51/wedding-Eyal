# Automation Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cron-triggered Edge Function that evaluates `automation_settings` rules daily and auto-populates `message_logs` with personalized, deduplicated WhatsApp messages for the `whatsapp-scheduler` to deliver.

**Architecture:** New `automation_settings` table stores per-event stage configs (stage name, days-before trigger, target RSVP status). The `automation-engine` Edge Function runs daily, finds stages whose trigger window has been reached (`event_date - today <= days_before`), queries eligible invitations, checks for existing logs to prevent duplicates, and bulk-inserts `pending` rows into `message_logs`. The existing `whatsapp-scheduler` handles delivery unchanged.

**Tech Stack:** Deno / TypeScript (same as `whatsapp-scheduler`), Supabase JS client v2, Supabase CLI (`supabase db push`, `supabase functions deploy`).

---

## ⚠️ CHECKPOINT PROTOCOL

**After Task 1** — STOP and show the user the migration file content. Do NOT proceed to Task 2 until the user explicitly says "yes, apply it."

---

## Task 1: Create Migration File

**Files:**
- Create: `supabase/migrations/20260223140000_create_automation_settings.sql`

**Step 1: Create the migration file**

```sql
-- supabase/migrations/20260223140000_create_automation_settings.sql

CREATE TABLE automation_settings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage_name    text        NOT NULL,
  days_before   integer     NOT NULL,
  target_status text        NOT NULL DEFAULT 'pending',
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS. No anon policies — only service role (edge functions) can access this table.
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
```

**Step 2: Show the file content to the user and ask for confirmation**

Print the full SQL content and say:
> "Migration file created at `supabase/migrations/20260223140000_create_automation_settings.sql`. Please review the SQL above. Shall I apply it with `supabase db push`?"

**DO NOT PROCEED until the user confirms.**

---

## Task 2: Apply Migration (After User Confirmation)

**Step 1: Apply the migration**

```bash
supabase db push
```

Expected output includes a line like:
```
Applying migration 20260223140000_create_automation_settings.sql...
```

If the command fails with "not linked", run `supabase link` first, then retry.

**Step 2: Verify the table exists**

In the Supabase Dashboard → Table Editor, confirm `automation_settings` appears with columns: `id`, `event_id`, `stage_name`, `days_before`, `target_status`, `is_active`, `created_at`.

Alternatively via SQL Editor:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'automation_settings'
ORDER BY ordinal_position;
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260223140000_create_automation_settings.sql
git commit -m "feat(db): add automation_settings table with RLS"
```

---

## Task 3: Create the Edge Function

**Files:**
- Create: `supabase/functions/automation-engine/index.ts`

**Step 1: Create the file with types and helpers**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutomationSetting {
  id:            string;
  event_id:      string;
  stage_name:    string;
  days_before:   number;
  target_status: string;
  event: {
    event_date:     string;
    slug:           string;
    content_config: Record<string, unknown>;
  };
}

interface Invitation {
  id:             string;
  event_id:       string;
  group_name:     string;
  phone_numbers:  string[];
  invited_pax:    number;
}

interface ExistingLog {
  invitation_id: string;
  phone:         string;
}

interface StageResult {
  stage:    string;
  event_id: string;
  queued:   number;
  skipped:  number;
  error?:   string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Replace {{variable}} placeholders in a template string. */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/**
 * Pick the singular or plural template variant for a stage.
 * Returns null if the stage has no template defined in content_config.
 */
function pickTemplate(
  contentConfig: Record<string, unknown>,
  stageName: string,
  pax: number,
): string | null {
  const templates = contentConfig.whatsapp_templates as
    | Record<string, { singular: string; plural: string }>
    | undefined;

  if (!templates || !templates[stageName]) return null;
  return pax === 1 ? templates[stageName].singular : templates[stageName].plural;
}
```

**Step 2: Add the main serve handler**

Append to the same file:

```typescript
// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

serve(async (req) => {
  console.log("--- [automation-engine] Triggered ---");

  // Optional: force_run=true bypasses the past-events guard (useful for testing)
  let forceRun = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      forceRun = body.force_run === true;
    } catch {
      // No body or invalid JSON — proceed normally
    }
  }

  if (forceRun) {
    console.log("[automation-engine] force_run=true — past-events guard bypassed.");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const frontendBaseUrl = Deno.env.get("FRONTEND_BASE_URL") ?? "";

  // ---------------------------------------------------------------------------
  // Step 1: Fetch all active automation settings (with their event details)
  // ---------------------------------------------------------------------------

  const { data: settingsData, error: settingsError } = await supabase
    .from("automation_settings")
    .select(`
      id, event_id, stage_name, days_before, target_status,
      event:events ( event_date, slug, content_config )
    `)
    .eq("is_active", true);

  if (settingsError) {
    console.error("[automation-engine] Failed to fetch settings:", settingsError.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch settings", message: settingsError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const settings = (settingsData ?? []) as AutomationSetting[];
  console.log(`[automation-engine] ${settings.length} active stage(s) found.`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stageResults: StageResult[] = [];
  let totalQueued = 0;

  // ---------------------------------------------------------------------------
  // Step 2: Process each stage
  // ---------------------------------------------------------------------------

  for (const setting of settings) {
    const { event_id, stage_name, days_before, target_status, event } = setting;

    // Calculate days until the event (floored to whole days)
    const eventDate = new Date(event.event_date);
    eventDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Skip past events unless force_run
    if (!forceRun && diffDays < 0) {
      console.log(
        `[automation-engine] Skipping ${stage_name} — event is in the past (diff=${diffDays}d).`,
      );
      stageResults.push({ stage: stage_name, event_id, queued: 0, skipped: 0 });
      continue;
    }

    // Skip if the trigger window hasn't been reached yet
    if (diffDays > days_before) {
      console.log(
        `[automation-engine] Stage ${stage_name} not yet due (diff=${diffDays}d, threshold=${days_before}d).`,
      );
      stageResults.push({ stage: stage_name, event_id, queued: 0, skipped: 0 });
      continue;
    }

    console.log(
      `[automation-engine] Processing: stage=${stage_name} | event_id=${event_id} | diff=${diffDays}d`,
    );

    try {
      // -----------------------------------------------------------------------
      // Step 3: Fetch eligible invitations
      // -----------------------------------------------------------------------

      const { data: invData, error: invError } = await supabase
        .from("invitations")
        .select("id, event_id, group_name, phone_numbers, invited_pax")
        .eq("event_id", event_id)
        .eq("rsvp_status", target_status)
        .eq("is_automated", true);

      if (invError) throw new Error(`Failed to fetch invitations: ${invError.message}`);

      const invitations = (invData ?? []) as Invitation[];
      console.log(
        `[automation-engine] ${invitations.length} eligible invitation(s) for stage ${stage_name}.`,
      );

      if (invitations.length === 0) {
        stageResults.push({ stage: stage_name, event_id, queued: 0, skipped: 0 });
        continue;
      }

      // -----------------------------------------------------------------------
      // Step 4: Fetch existing logs → build anti-duplicate Set<"invId:phone">
      // -----------------------------------------------------------------------

      const invitationIds = invitations.map((inv) => inv.id);

      const { data: logsData, error: logsError } = await supabase
        .from("message_logs")
        .select("invitation_id, phone")
        .eq("event_id", event_id)
        .eq("message_type", stage_name)
        .in("invitation_id", invitationIds);

      if (logsError) throw new Error(`Failed to fetch existing logs: ${logsError.message}`);

      const sentKeys = new Set<string>(
        (logsData ?? []).map((log: ExistingLog) => `${log.invitation_id}:${log.phone}`),
      );

      // -----------------------------------------------------------------------
      // Step 5 & 6: For each invitation × phone, check duplicate and build content
      // -----------------------------------------------------------------------

      const newRows: Array<{
        event_id:      string;
        invitation_id: string;
        phone:         string;
        message_type:  string;
        content:       string;
        status:        string;
        scheduled_for: null;
      }> = [];

      let skipped = 0;

      for (const invitation of invitations) {
        const template = pickTemplate(event.content_config, stage_name, invitation.invited_pax);

        if (!template) {
          console.warn(
            `[automation-engine] No template for stage "${stage_name}" — skipping invitation ${invitation.id}.`,
          );
          skipped += invitation.phone_numbers.length;
          continue;
        }

        const content = interpolate(template, {
          name:          invitation.group_name,
          couple_names:  (event.content_config.couple_names as string) ?? "",
          link:          `${frontendBaseUrl}/${event.slug}`,
          waze_link:     (event.content_config.waze_link as string) ?? "",
        });

        for (const phone of invitation.phone_numbers) {
          const key = `${invitation.id}:${phone}`;

          if (sentKeys.has(key)) {
            console.log(`[automation-engine] Duplicate — skipping ${key} for stage ${stage_name}.`);
            skipped++;
            continue;
          }

          newRows.push({
            event_id,
            invitation_id: invitation.id,
            phone,
            message_type:  stage_name,
            content,
            status:        "pending",
            scheduled_for: null,
          });
        }
      }

      // -----------------------------------------------------------------------
      // Step 7: Bulk insert
      // -----------------------------------------------------------------------

      if (newRows.length > 0) {
        const { error: insertError } = await supabase
          .from("message_logs")
          .insert(newRows);

        if (insertError) throw new Error(`Failed to insert message_logs: ${insertError.message}`);
      }

      console.log(
        `[automation-engine] Stage ${stage_name}: queued=${newRows.length} | skipped=${skipped}`,
      );
      stageResults.push({ stage: stage_name, event_id, queued: newRows.length, skipped });
      totalQueued += newRows.length;

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[automation-engine] ERROR in stage ${stage_name}:`, errMsg);
      stageResults.push({ stage: stage_name, event_id, queued: 0, skipped: 0, error: errMsg });
    }
  }

  const summary = { processed: settings.length, total_queued: totalQueued, stages: stageResults };
  console.log("[automation-engine] Done —", JSON.stringify(summary));

  return new Response(
    JSON.stringify(summary),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
```

**Step 3: Verify the file compiles (no syntax errors)**

Run:
```bash
deno check supabase/functions/automation-engine/index.ts
```

Expected: No errors output. If `deno` is not installed locally, skip this step — the deploy step will catch errors.

**Step 4: Commit**

```bash
git add supabase/functions/automation-engine/index.ts
git commit -m "feat(functions): automation-engine edge function"
```

---

## Task 4: Set Environment Variable

**Step 1: Add `FRONTEND_BASE_URL` to Supabase Edge Function secrets**

In the Supabase Dashboard → Edge Functions → Settings → Secrets, add:

```
FRONTEND_BASE_URL = https://eyal-and-mor.wedding
```

(Or whichever base URL the wedding site is served from.)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase for all edge functions — no manual configuration needed for those.

---

## Task 5: Deploy the Edge Function

**Step 1: Deploy**

```bash
supabase functions deploy automation-engine
```

Expected output:
```
Deploying automation-engine...
Done: automation-engine deployed.
```

**Step 2: Note the function URL**

Copy the function URL from the Supabase Dashboard → Edge Functions → automation-engine. It looks like:
```
https://<project-ref>.supabase.co/functions/v1/automation-engine
```

---

## Task 6: Seed Test Data & Verify

**Step 1: Insert a test stage via Supabase SQL Editor**

Replace `<your-event-id>` with the actual UUID from `SELECT id FROM events LIMIT 1;`

```sql
INSERT INTO automation_settings (event_id, stage_name, days_before, target_status, is_active)
VALUES (
  '<your-event-id>',
  'icebreaker',
  999,          -- high number ensures it triggers on any test run
  'pending',
  true
);
```

**Step 2: Trigger the function with `force_run=true`**

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/automation-engine \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"force_run": true}'
```

Expected response shape:
```json
{
  "processed": 1,
  "total_queued": <N>,
  "stages": [
    { "stage": "icebreaker", "event_id": "...", "queued": <N>, "skipped": 0 }
  ]
}
```

**Step 3: Verify rows in `message_logs`**

```sql
SELECT invitation_id, phone, message_type, status, content
FROM message_logs
WHERE message_type = 'icebreaker'
ORDER BY created_at DESC
LIMIT 10;
```

Each eligible invitation should have one row per phone number with `status = 'pending'`.

**Step 4: Verify the anti-duplicate check**

Run the same curl command again. The response should show `queued: 0, skipped: <N>` because all rows already exist.

**Step 5: Clean up test data (optional)**

```sql
DELETE FROM message_logs WHERE message_type = 'icebreaker' AND status = 'pending';
DELETE FROM automation_settings WHERE days_before = 999;
```

**Step 6: Commit**

No new files to commit — this is a verification-only task. But if you adjusted any code based on test findings, commit those changes:

```bash
git add -p
git commit -m "fix(functions): automation-engine test fixes"
```

---

## Task 7: Configure Cron Job

**Step 1: In Supabase Dashboard → Database → Extensions, enable `pg_cron` if not already enabled.**

**Step 2: In SQL Editor, schedule the daily run at 08:00 Jerusalem time**

Jerusalem is UTC+2 (standard) / UTC+3 (DST). 08:00 local ≈ 06:00 UTC (conservative):

```sql
SELECT cron.schedule(
  'automation-engine-daily',
  '0 6 * * *',   -- 06:00 UTC = ~08:00 Jerusalem
  $$
    SELECT net.http_post(
      url    := 'https://<project-ref>.supabase.co/functions/v1/automation-engine',
      headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
      body   := '{}'::jsonb
    );
  $$
);
```

Replace `<project-ref>` and `<SERVICE_ROLE_KEY>` with real values.

**Step 3: Verify the cron job is registered**

```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'automation-engine-daily';
```

---

## Summary

| Task | What it does |
|---|---|
| 1 | Creates `automation_settings` migration (pause for review) |
| 2 | Applies migration after user confirmation |
| 3 | Implements `automation-engine` edge function |
| 4 | Sets `FRONTEND_BASE_URL` secret in Supabase |
| 5 | Deploys the function |
| 6 | Seeds test data and verifies deduplication |
| 7 | Wires up daily cron job |
