# Security — RLS & P0 launch-safety

Live column/policy/grant truth is in [SCHEMA.md](./SCHEMA.md). This file is the *why*.

## The root hole that P0 closed
> Postgres grants `EXECUTE` to `PUBLIC` by default. That was the anon-exec hole.
> All P0 fixes `REVOKE ... FROM PUBLIC` (not only from `anon`).

P0 = migrations `20260614120000`–`20260614120200`.

## `arrival_permits` RLS (migration `20260614120000`)
Was: broad anon INSERT/UPDATE/SELECT — **removed**.
- **No anon policies** — anon has zero direct table access; public writes go through the `submit_rsvp` RPC only.
- Owners (`user_events` membership): SELECT / INSERT / UPDATE for their own event's rows.
- Super admins (`users.is_super_admin`): SELECT / INSERT / UPDATE / **DELETE**.

## `automation_settings` RLS (current live state)
Original `20260226100000` anon policies were superseded by the multi-tenant migration.
- SELECT / UPDATE / INSERT (stage whitelist in `WITH CHECK`) scoped to event owners via `user_events`; super-admin mirror incl. DELETE. **No anon policies** — the dashboard mutates these as the authenticated owner.

## P0 RPCs & grants

**`submit_rsvp(p_event_id, p_full_name, p_phone, p_attending, p_guests_count, p_needs_parking)`**
- `SECURITY DEFINER SET search_path = public` — the ONLY public RSVP write path.
- Requires the event to exist and be `status='active'`; rejects draft/missing. Upserts the `(event_id, phone)` row on `arrival_permits_event_phone_unique`.
- `REVOKE FROM PUBLIC`; `GRANT EXECUTE TO anon, authenticated`. Called by `submitRsvp()` in `src/lib/supabase.js`.

**`user_can_manage_event(p_event_id) → boolean`**
- `SECURITY DEFINER STABLE` — true if caller is in `user_events` for the event OR `users.is_super_admin`. `REVOKE FROM PUBLIC, anon`; `GRANT TO authenticated`. The ownership guard inside the config mutators.

**Mutator hardening** — `toggle_auto_pilot`, `update_whatsapp_template`, `delete_dynamic_nudge`, `create_invitation_from_permit`, `link_permit_to_invitation`, `create_onboarding_event` are `REVOKE FROM PUBLIC, anon` + `GRANT TO authenticated`. Each (except self-authorizing `create_onboarding_event`) guards with:
```sql
IF auth.uid() IS NULL OR NOT public.user_can_manage_event(<eid>) THEN
  RAISE EXCEPTION '...' USING ERRCODE = '42501';
END IF;
```
`link_permit_to_invitation` also requires the target invitation's `event_id` to match the permit's event. Internal-only `handle_new_auth_user`, `sync_arrival_to_invitation`, `phone_core` are revoked from all client roles.

**`claim_pending_messages(p_limit int DEFAULT 15) → SETOF message_logs`** (migration `20260614120200`)
- `SECURITY DEFINER` — atomic queue claim: `UPDATE ... SET status='processing' ... WHERE id IN (SELECT ... WHERE status='pending' AND due ... FOR UPDATE SKIP LOCKED) RETURNING *`. Overlapping runs get disjoint rows → at-most-once send.
- **At-most-once by design:** no auto-reclaim of stuck `processing` rows (Green API not idempotent); stuck rows need manual requeue. `REVOKE FROM PUBLIC, anon, authenticated`; `GRANT TO service_role`. Called by `whatsapp-scheduler/index.ts`.

## In-flight (not yet merged)
P0 follow-ups under Codex cross-review: `users_revoke_self_super_admin`, `user_events_revoke_self_grant` (+ rollbacks). See `supabase/migrations/2026061514*` and `process/prompts/codex-p0-*`.
