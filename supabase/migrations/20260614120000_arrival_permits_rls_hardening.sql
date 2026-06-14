-- ═══════════════════════════════════════════════════════════════════════
-- arrival_permits RLS hardening + safe public RSVP path (submit_rsvp RPC)
--
-- PROBLEM (pre-migration live state):
--   arrival_permits had broad anon policies — anon could SELECT every row
--   (all guests' names + phones across ALL events) and UPDATE any row.
--   The authenticated policies were equally broad (USING true), so any
--   logged-in user could read/modify every event's RSVP data.
--
-- FIX:
--   1. Drop all anon policies and the broad authenticated policies.
--   2. Replace authenticated access with user_events ownership + super-admin
--      mirror (same pattern as invitations / message_logs).
--   3. Route the public RSVP write through a narrow SECURITY DEFINER RPC
--      (submit_rsvp) that is event-scoped and only accepts active events.
--      Anon no longer has ANY direct table access — the RPC is the only
--      public write path, and it can only touch the one (event_id, phone)
--      row it is given.
--
-- Paired rollback: supabase/rollback/20260614120000_arrival_permits_rls_hardening.down.sql
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.arrival_permits ENABLE ROW LEVEL SECURITY;

-- ── 1. Drop unsafe policies ────────────────────────────────────────────
-- anon policies (broad — remove entirely; public path moves to submit_rsvp)
DROP POLICY IF EXISTS "Allow anon insert"  ON public.arrival_permits;
DROP POLICY IF EXISTS "Allow anon update"  ON public.arrival_permits;
DROP POLICY IF EXISTS "Allow anon select"  ON public.arrival_permits;
DROP POLICY IF EXISTS "wedding-policy"     ON public.arrival_permits;

-- broad authenticated policies (both historical naming variants, for
-- replay-safety on a freshly-built database)
DROP POLICY IF EXISTS "Allow authenticated insert"                  ON public.arrival_permits;
DROP POLICY IF EXISTS "Allow authenticated update"                  ON public.arrival_permits;
DROP POLICY IF EXISTS "Allow authenticated select"                  ON public.arrival_permits;
DROP POLICY IF EXISTS "Allow authenticated insert arrival_permits"  ON public.arrival_permits;
DROP POLICY IF EXISTS "Allow authenticated update arrival_permits"  ON public.arrival_permits;
DROP POLICY IF EXISTS "Allow authenticated select arrival_permits"  ON public.arrival_permits;

-- ── 2a. Owner policies (scoped to user_events membership) ──────────────
CREATE POLICY "Owners can select arrival_permits"
  ON public.arrival_permits FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = arrival_permits.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update arrival_permits"
  ON public.arrival_permits FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = arrival_permits.event_id AND ue.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = arrival_permits.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert arrival_permits"
  ON public.arrival_permits FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = arrival_permits.event_id AND ue.user_id = auth.uid()
    )
  );

-- ── 2b. Super-admin mirror (parity with invitations) ───────────────────
CREATE POLICY "Super admins can select arrival_permits"
  ON public.arrival_permits FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "Super admins can insert arrival_permits"
  ON public.arrival_permits FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "Super admins can update arrival_permits"
  ON public.arrival_permits FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

CREATE POLICY "Super admins can delete arrival_permits"
  ON public.arrival_permits FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );

-- ── 3. Narrow public RSVP write path ───────────────────────────────────
-- SECURITY DEFINER: runs as table owner, bypassing RLS — but it can only
-- write the single (event_id, phone) row it is called with, and only for an
-- event that exists and is 'active'. Anon cannot read or enumerate any data.
-- The BEFORE INSERT/UPDATE trigger (sync_arrival_to_invitation) still fires,
-- so guest↔invitation matching is preserved unchanged.
CREATE OR REPLACE FUNCTION public.submit_rsvp(
  p_event_id      uuid,
  p_full_name     text,
  p_phone         text,
  p_attending     boolean,
  p_guests_count  smallint,
  p_needs_parking boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'Phone is required' USING ERRCODE = '22023';
  END IF;

  -- Event must exist and be active to accept public RSVPs.
  SELECT status INTO v_status FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = '22023';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Event is not accepting RSVPs' USING ERRCODE = '22023';
  END IF;

  INSERT INTO arrival_permits (event_id, full_name, phone, attending, guests_count, needs_parking)
  VALUES (p_event_id, p_full_name, p_phone, p_attending, p_guests_count, p_needs_parking)
  ON CONFLICT ON CONSTRAINT arrival_permits_event_phone_unique DO UPDATE
    SET full_name     = EXCLUDED.full_name,
        attending     = EXCLUDED.attending,
        guests_count  = EXCLUDED.guests_count,
        needs_parking = EXCLUDED.needs_parking,
        updated_at    = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_rsvp(uuid, text, text, boolean, smallint, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_rsvp(uuid, text, text, boolean, smallint, boolean) TO anon, authenticated;
