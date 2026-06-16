# Phase 2 — WhatsApp Automation & Scheduler

**Infrastructure:** outbound via Green API. Custom scheduler `supabase/functions/whatsapp-scheduler/` processes `message_logs` rows with `status='pending'`, respects operating hours (Asia/Jerusalem, Shabbat-aware), marks rows `sent`/`failed`. Inbound auto-replies currently PAUSED.

The dashboard UI for all of this lives in [DASHBOARD.md](./DASHBOARD.md) (Timeline V2 + Message History). DB columns/RPCs in [SCHEMA.md](./SCHEMA.md).

## Queue mechanics
`claim_pending_messages(p_limit)` (service_role only) atomically claims due `pending` rows via `FOR UPDATE SKIP LOCKED`, flips them to `processing`, stamps `processing_started_at`, and returns them. Overlapping scheduler runs get disjoint rows → **at-most-once** send. No auto-reclaim of stuck `processing` rows (Green API isn't idempotent) — stuck rows need manual requeue. Rationale in [SECURITY.md](./SECURITY.md).

## Track A — Automated funnel (background)
Stages, in order:
- **Icebreaker** — initial broadcast with the event link.
- **Gentle Nudge** — periodic follow-ups, ONLY to `'pending'` (ממתינים).
- **Ultimatum** — final notice to `'pending'` just before the venue deadline.
- **Logistics** — venue navigation X hours before, ONLY to confirmed attendees.
- **Hangover** — post-event gratitude to attendees the day after.

Admin maps these as an opinionated pipeline with "hard anchors" (e.g. Event Day) and toggleable nudge nodes with fixed rules to prevent user error. Each node shows live `message_logs` stats (sent vs pending). `is_automated` on `invitations` is the per-guest opt-in.

## Track B — Manual custom messages (dashboard)
- **Bulk actions:** select guests via table checkboxes → manual broadcast.
- **Send modal:** load a funnel template (tweak inline) OR free-text from scratch.
- **Dynamic variables:** `{{name}}` etc. interpolated per-record before pushing to the scheduler.

## Template storage
`events.content_config.whatsapp_templates` holds default text per stage as `{singular, plural}` variants. Mutated only via the `update_whatsapp_template` RPC (whitelisted stage names, `jsonb_set` patch — no full-row replace). `stage_name` whitelist: `icebreaker, nudge, nudge_1, nudge_2, nudge_3, ultimatum, logistics, hangover`.
