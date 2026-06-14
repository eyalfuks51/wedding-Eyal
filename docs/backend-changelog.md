# Backend Changelog

Tracks DB schema, RLS, grant, and RPC contract changes. Newest first.

---

## 2026-06-14 — P0 launch-safety hardening (branch `feature/guesto-p0-launch-safety`)

Three new migrations + one edited-in-place migration close pre-launch
multi-tenant security holes. None of these has been applied to production yet —
each ships with a paired rollback under `supabase/rollback/` and must pass the
migration gate before being pushed.

### Migration `20260614120000_arrival_permits_rls_hardening.sql`

**`arrival_permits` RLS — broad anon/authenticated access removed.**
- Dropped: `Allow anon insert/update/select`, `wedding-policy`, and the broad
  `Allow authenticated insert/update/select` policies (both historical naming
  variants). Previously anon could `SELECT`/`UPDATE` every row across all events.
- Added owner policies (SELECT/INSERT/UPDATE) scoped to
  `user_events(user_id = auth.uid(), event_id = arrival_permits.event_id)`.
- Added super-admin mirror policies (SELECT/INSERT/UPDATE/DELETE) gated on
  `users.is_super_admin = true` — parity with `invitations` / `message_logs`.
- Anon now has **no direct table access** to `arrival_permits`.

**New RPC `submit_rsvp(p_event_id uuid, p_full_name text, p_phone text, p_attending boolean, p_guests_count smallint, p_needs_parking boolean) RETURNS void`**
- `SECURITY DEFINER SET search_path = public`.
- The **only** public RSVP write path. Validates phone is non-empty; requires
  the event to exist and have `status = 'active'` (raises `22023` otherwise).
- Upserts a single `(event_id, phone)` row via
  `ON CONFLICT ON CONSTRAINT arrival_permits_event_phone_unique`. Cannot read or
  enumerate other rows. The `sync_arrival_to_invitation` trigger still fires.
- Grants: `REVOKE EXECUTE ... FROM PUBLIC`, then `GRANT EXECUTE TO anon, authenticated`.
- **Frontend contract:** `src/lib/supabase.js` `submitRsvp()` now calls
  `supabase.rpc('submit_rsvp', { p_event_id, p_full_name, p_phone, p_attending, p_guests_count, p_needs_parking })`
  instead of a direct `arrival_permits` upsert.
- **Behavioral consequence:** RSVPs to a non-`active` event are now rejected.
  Events in `draft` status (e.g. `mor-and-eyal`) will not accept new public RSVPs
  until promoted to `active`.

### Migration `20260614120100_rpc_revoke_anon_and_ownership.sql`

**Closes the anon-execute hole and adds ownership checks to config mutators.**
Root cause: Postgres grants `EXECUTE` to `PUBLIC` by default, so every RPC was
anon-callable and the config mutators performed no ownership check.

- New helper `user_can_manage_event(p_event_id uuid) RETURNS boolean`
  (`SECURITY DEFINER STABLE SET search_path = public`): true if the caller is a
  member via `user_events` OR `users.is_super_admin`. `REVOKE FROM PUBLIC, anon`;
  `GRANT TO authenticated`.
- `REVOKE EXECUTE ... FROM PUBLIC, anon` + `GRANT ... TO authenticated` on the
  client-callable mutators: `toggle_auto_pilot`, `update_whatsapp_template`,
  `delete_dynamic_nudge`, `create_invitation_from_permit`,
  `link_permit_to_invitation`, `create_onboarding_event`.
- `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` on internal-only
  functions: `handle_new_auth_user`, `sync_arrival_to_invitation`, `phone_core`.
  (`service_role`/`postgres` retain EXECUTE; SECURITY DEFINER triggers still run.)
- Ownership guard prepended to all five config mutators:
  `IF auth.uid() IS NULL OR NOT public.user_can_manage_event(<event_id>) THEN RAISE EXCEPTION ... ERRCODE 42501`.
  (`create_onboarding_event` already self-authorizes via `auth.uid()`.)
- `link_permit_to_invitation` additionally verifies the **target invitation's**
  `event_id` equals the permit's `event_id` (raises `42501` on mismatch) — without
  this an owner of event A could mutate an invitation belonging to event B.

### Migration `20260614120200_whatsapp_atomic_claim.sql`

**Atomic queue claiming — eliminates WhatsApp duplicate-send.**
- New column `message_logs.processing_started_at timestamptz` (observability:
  records when a row was claimed).
- New RPC `claim_pending_messages(p_limit int DEFAULT 15) RETURNS SETOF message_logs`
  (`SECURITY DEFINER SET search_path = public`): a single `UPDATE ... SET status='processing' ... WHERE id IN (SELECT ... WHERE status='pending' AND due ORDER BY scheduled_for LIMIT p_limit FOR UPDATE SKIP LOCKED) RETURNING *`.
  Two overlapping callers receive **disjoint** row sets, so a message is claimed
  (and sent) at most once. `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`;
  `GRANT TO service_role` only.
- **Design: at-most-once, not at-least-once.** There is deliberately **no**
  auto-reclaim of rows stuck in `processing`. Green API sends are not idempotent
  (no client dedup key), so any reclaim window could re-message a guest whose send
  succeeded but whose `sent` DB write failed. Rows stuck in `processing` (rare:
  worker crash between send and status write) require **manual requeue**, not
  automatic resend.
- **Edge-function contract:** `supabase/functions/whatsapp-scheduler/index.ts`
  now claims via `supabase.rpc('claim_pending_messages', { p_limit: 15 })` before
  sending, instead of a plain `SELECT ... WHERE status='pending'`.

### Edited-in-place: `20260304090000_schedule_automation_cron.sql` (hygiene exception)

- Removed a hardcoded `service_role` JWT (appeared twice in cron `command` text),
  replacing the literal `'Bearer eyJ...'` with
  `'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')`.
- This edits an already-applied migration — a deliberate exception because the
  secret must not remain in the tree. **The secret is still present in git history
  (commit `ac99e5a`) and in the live `cron.job` command text.** Rotation is an
  **external Eyal action**, not done by this slice (see REPORT.md): rotate the
  key in the Supabase dashboard, store the new key in Vault as `service_role_key`,
  and re-schedule the two cron jobs in prod so they read from Vault.

### Rollbacks

Each migration has a paired down-file under `supabase/rollback/`:
`20260614120000_*.down.sql`, `20260614120100_*.down.sql`,
`20260614120200_*.down.sql`.
