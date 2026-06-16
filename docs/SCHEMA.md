# Database Schema (live)

> **AUTO-GENERATED above the divider. Generated 2026-06-16 from the live Supabase DB.**
> Regenerate by running `scripts/gen-context.sql` through the `supabase-db` MCP after any
> migration. Do NOT hand-edit the generated section — edits belong below the divider.
> The old "🚨 SCHEMA SYNC: document changes before coding" rule still holds, but this file
> is now the source of truth, not a hand-typed copy.

PK = primary key. FK targets noted inline. `default` shown only when set.

### `events` — one row per wedding (central config)
| column | type | null | default / notes |
|---|---|---|---|
| `id` | uuid | NO | PK, `gen_random_uuid()` |
| `created_at` | timestamptz | YES | `now()` |
| `slug` | text | NO | UNIQUE — the `/:slug` URL identifier |
| `partner1_name` | text | YES | |
| `partner2_name` | text | YES | |
| `event_date` | date | YES | |
| `google_sheet_id` | text | YES | target sheet for `sync-to-sheets` |
| `content_config` | jsonb | YES | UI text, maps, `whatsapp_templates` (singular/plural) |
| `template_id` | text | YES | `'wedding-default'` — selects the React template |
| `automation_config` | jsonb | YES | reminders/limits + `auto_pilot` boolean |
| `status` | text | NO | `'draft'` — **gates everything public**: anon SELECT and `submit_rsvp` require `status='active'` |

### `invitations` — one family/group invited (dashboard source of truth)
| column | type | null | default / notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `event_id` | uuid | YES | FK → events.id |
| `group_name` | text | NO | e.g. "אייל ומור" |
| `phone_numbers` | text[] | YES | `{}` |
| `invited_pax` | int | YES | `1` — drives singular/plural messaging |
| `confirmed_pax` | int | YES | `0` |
| `rsvp_status` | text | YES | `'pending'` |
| `is_automated` | bool | YES | `false` — Track A opt-in toggle |
| `messages_sent_count` | int | YES | `0` |
| `last_message_sent_at` | timestamptz | YES | |
| `side` | varchar | YES | classification / dashboard filter |
| `guest_group` | varchar | YES | classification / dashboard filter |
| `created_at` | timestamptz | YES | `now()` |
| `updated_at` | timestamptz | YES | `now()` |

### `arrival_permits` — RSVP submissions from the public form
| column | type | null | default / notes |
|---|---|---|---|
| `id` | bigint | NO | PK |
| `created_at` | timestamptz | NO | `now()` |
| `full_name` | text | YES | |
| `phone` | text | NO | UNIQUE per event (`arrival_permits_event_phone_unique`) |
| `attending` | bool | YES | |
| `needs_parking` | bool | YES | |
| `guests_count` | smallint | YES | actual attending count |
| `event_id` | uuid | YES | FK → events.id |
| `invitation_id` | uuid | YES | FK → invitations.id — set when matched to a known group |
| `match_status` | text | NO | `'unmatched'` — permit↔invitation reconciliation state |
| `updated_at` | timestamptz | YES | |

### `message_logs` — WhatsApp queue + history
| column | type | null | default / notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `event_id` | uuid | NO | FK → events.id |
| `invitation_id` | uuid | NO | FK → invitations.id |
| `phone` | text | NO | |
| `message_type` | text | NO | `'icebreaker'`, `'nudge'`, `'custom'`, … |
| `content` | text | NO | personalized message text |
| `status` | text | NO | `'pending'` → `'processing'` → `'sent'` / `'failed'` |
| `error_log` | text | YES | |
| `scheduled_for` | timestamptz | YES | `now()` — when it should send |
| `processing_started_at` | timestamptz | YES | set when `claim_pending_messages` claims the row |
| `sent_at` | timestamptz | YES | |
| `created_at` | timestamptz | YES | `now()` |

### `automation_settings` — one row per funnel stage per event
| column | type | null | default / notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `event_id` | uuid | NO | FK → events.id |
| `stage_name` | text | NO | matches `whatsapp_templates` key |
| `days_before` | int | NO | positive = before event, negative = after |
| `target_status` | text | NO | `'pending'` or `'attending'` (business invariant, not UI-editable) |
| `is_active` | bool | NO | `true` |
| `created_at` | timestamptz | NO | `now()` |

### `user_events` — ownership join (multi-tenant authz spine)
| column | type | null | default / notes |
|---|---|---|---|
| `id` | uuid | NO | PK |
| `user_id` | uuid | NO | FK → auth user |
| `event_id` | uuid | NO | FK → events.id |
| `role` | text | NO | `'owner'` |
| `created_at` | timestamptz | NO | `now()` |

### `users` — app profile mirror of auth.users
| column | type | null | default / notes |
|---|---|---|---|
| `id` | uuid | NO | PK = auth.uid() |
| `email` | text | NO | |
| `full_name` | text | YES | |
| `avatar_url` | text | YES | |
| `is_super_admin` | bool | NO | `false` — super-admin mirror across all RLS |
| `created_at` | timestamptz | NO | `now()` |

## RLS model (all tables RLS-enabled)
Pattern across business tables: **owner access via `user_events` membership** + a **super-admin mirror** (`users.is_super_admin`). Detail in [SECURITY.md](./SECURITY.md).
- `arrival_permits` — owners SELECT/INSERT/UPDATE; super-admin SELECT/INSERT/UPDATE/**DELETE**. **No anon policy** (public writes go through `submit_rsvp` RPC only).
- `events` — anon + authenticated SELECT where `status='active'`; owners SELECT/UPDATE; authenticated INSERT; super-admin all incl. DELETE.
- `invitations`, `message_logs` — owners SELECT/INSERT/UPDATE; super-admin all incl. DELETE.
- `automation_settings` — owners SELECT/UPDATE + INSERT (stage-name whitelist in `WITH CHECK`); super-admin all incl. DELETE. No anon.
- `user_events`, `users` — self-scoped (`user_id`/`id = auth.uid()`).

## RPCs (signature · security · grant)
> Postgres grants EXECUTE to PUBLIC by default — every client-facing RPC must show an explicit role list. `(default: PUBLIC)` here = a grant hole.

| function | args | security | grant |
|---|---|---|---|
| `submit_rsvp` | `p_event_id uuid, p_full_name text, p_phone text, p_attending boolean, p_guests_count smallint, p_needs_parking boolean` | DEFINER | anon, authenticated, service_role |
| `user_can_manage_event` | `p_event_id uuid` | DEFINER | authenticated, service_role |
| `toggle_auto_pilot` | `p_event_id uuid, p_enabled boolean` | DEFINER | authenticated, service_role |
| `update_whatsapp_template` | `p_event_id uuid, p_stage_name text, p_singular text, p_plural text` | DEFINER | authenticated, service_role |
| `delete_dynamic_nudge` | `p_setting_id uuid` | DEFINER | authenticated, service_role |
| `create_invitation_from_permit` | `p_permit_id bigint` | DEFINER | authenticated, service_role |
| `link_permit_to_invitation` | `p_permit_id bigint, p_invitation_id uuid` | DEFINER | authenticated, service_role |
| `create_onboarding_event` | `p_slug text, p_template_id text, p_content_config jsonb, p_partner1_name text, p_partner2_name text, p_event_date date` | DEFINER | authenticated, service_role |
| `claim_pending_messages` | `p_limit integer` | DEFINER | service_role only |
| `handle_new_auth_user` | (trigger) | DEFINER | service_role only (internal) |
| `sync_arrival_to_invitation` | (trigger) | DEFINER | service_role only (internal) |
| `phone_core` | `p text` | INVOKER | service_role only (internal) |

<!-- ───────────────────────── divider: hand-maintained notes below ───────────────────────── -->

## Hand-maintained notes (semantics the introspection can't show)

- **`events.status` is the master gate.** `'draft'` events are invisible to anon and reject RSVPs. Onboarding creates events; flipping to `'active'` is what publishes a wedding.
- **`arrival_permits.match_status` + `invitation_id`** are the reconciliation layer: a public RSVP arrives unmatched, then is linked to a known `invitations` group (manually or via `create_invitation_from_permit` / `link_permit_to_invitation`). `link_permit_to_invitation` enforces that the invitation's `event_id` matches the permit's.
- **`claim_pending_messages` is at-most-once by design** — no auto-reclaim of stuck `processing` rows (Green API is not idempotent). Stuck rows need manual requeue. See [AUTOMATION.md](./AUTOMATION.md).
- **Triggers:** `sheets_sync_trigger` on `arrival_permits` INSERT/UPDATE → `sync-to-sheets` edge function. `handle_new_auth_user` mirrors `auth.users` → `public.users`. `sync_arrival_to_invitation` keeps the permit↔invitation link in sync.
- Full RLS predicates + the P0 launch-safety rationale live in [SECURITY.md](./SECURITY.md).
