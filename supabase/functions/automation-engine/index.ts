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
