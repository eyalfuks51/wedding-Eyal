# Automation Engine Design
**Date:** 2026-02-23
**Status:** Approved
**Phase:** Phase 2 — WhatsApp Automation

---

## Overview

A daily cron-triggered Edge Function (`automation-engine`) that evaluates configurable message stages against the current event timeline and automatically queues personalized WhatsApp messages into `message_logs` for delivery by the existing `whatsapp-scheduler`.

The engine is the **population layer** — it creates rows. The scheduler is the **delivery layer** — it sends them.

---

## Database Schema

### New table: `automation_settings`

```sql
CREATE TABLE automation_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage_name    text NOT NULL,        -- 'icebreaker', 'nudge_1', 'ultimatum', etc.
  days_before   integer NOT NULL,     -- trigger when event_date - today <= days_before
  target_status text NOT NULL DEFAULT 'pending',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

No changes to existing tables. The `events.automation_config` JSONB column is reserved for future per-event overrides (e.g. pausing all automation for a specific event) but is not used in this phase.

---

## Edge Function: `automation-engine`

**File:** `supabase/functions/automation-engine/index.ts`
**Trigger:** Daily Supabase cron job (HTTP POST). Recommended: 08:00 AM Asia/Jerusalem.
**Override:** Accepts `POST { force_run: true }` to bypass the past-events guard (useful for testing).

### Processing Algorithm

For each active stage in `automation_settings`:

```
1. FETCH automation_settings WHERE is_active = true, JOIN events for event_date + content_config
2. FILTER stages: DATE(event_date) - DATE(now()) <= days_before
                  AND DATE(event_date) >= DATE(now())   ← skip past events
3. FETCH eligible invitations:
   WHERE event_id = stage.event_id
   AND rsvp_status = stage.target_status
   AND is_automated = true
4. FETCH existing logs (anti-duplicate set):
   SELECT invitation_id, phone, message_type FROM message_logs
   WHERE event_id = stage.event_id AND message_type = stage.stage_name
   → Build Set<"invitationId:phone">
5. FOR EACH invitation × phone_number in invitation.phone_numbers:
   IF "invitationId:phone" NOT IN set → queue
6. BUILD content: interpolate content_config.whatsapp_templates[stage_name]
   - Use invited_pax to pick singular vs plural variant
   - Interpolate: {{name}}, {{couple_names}}, {{link}}, {{waze_link}}
7. BULK INSERT new rows into message_logs:
   status = 'pending', scheduled_for = NULL
8. LOG summary: { stage, queued, skipped }
```

### Phone Targeting

Each invitation's entire `phone_numbers` array receives the message. One `message_logs` row is inserted per `(invitation_id, phone)` pair. The anti-duplicate check is keyed on `(invitation_id, phone, stage_name)` — all three must be unique for a message to be queued.

### Day Window Logic

The trigger condition is `date_diff <= days_before` (catch-up semantics). If the cron misses a day, the next run picks up any stages whose window has passed. The anti-duplicate check prevents double-sends. Events where `event_date < today` are excluded to avoid post-event message floods.

### Error Handling

- Each stage is processed in an independent `try/catch`. A failure in one stage does not abort others.
- Failed stages are captured in the response but do not cause the function to return a non-200 status.
- Response: `200 OK` with `{ processed: N, total_queued: N, stages: [{ name, queued, skipped, error? }] }`.

---

## Message Content Generation

Templates are sourced from `events.content_config.whatsapp_templates[stage_name]`, which stores `{ singular: "...", plural: "..." }` variants. The engine picks the variant based on `invitation.invited_pax`.

Interpolation variables (consistent with Dashboard.tsx manual send):
| Variable | Source |
|---|---|
| `{{name}}` | `invitation.group_name` |
| `{{couple_names}}` | `event.content_config.couple_names` |
| `{{link}}` | `https://eyal-and-mor.wedding/{event.slug}` |
| `{{waze_link}}` | `event.content_config.waze_link` |

---

## Integration with Existing Architecture

```
automation-engine (daily cron)
  └── writes message_logs rows (status='pending', scheduled_for=NULL)
        └── whatsapp-scheduler (frequent cron, Shabbat-aware)
              └── sends via Green API → marks sent/failed
```

The `whatsapp-scheduler` already handles operating hours and Shabbat windows, so `automation-engine` simply drops rows into the queue without specifying a `scheduled_for` time.

---

## Cron Configuration

Add a second cron job in the Supabase dashboard pointing to the `automation-engine` function URL.
Recommended schedule: daily at **08:00 Jerusalem time** (before the scheduler's first operating-hours window).

---

## Out of Scope (This Phase)

- Per-event automation pause/resume via `events.automation_config` (schema reserved)
- Inbound webhook auto-reply (`whatsapp-webhook` remains paused)
- Dashboard UI for managing `automation_settings` rows
