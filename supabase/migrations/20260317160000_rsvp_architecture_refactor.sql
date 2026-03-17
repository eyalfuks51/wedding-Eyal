-- Phase 6: RSVP Architecture Refactor & Tech Debt Cleanup
-- Fully idempotent — safe to re-run

-- ============================================================
-- 6.1: Add invitation_id and match_status to arrival_permits
-- ============================================================
ALTER TABLE public.arrival_permits
  ADD COLUMN IF NOT EXISTS invitation_id uuid REFERENCES public.invitations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_status text NOT NULL DEFAULT 'unmatched';

-- Add CHECK constraint idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arrival_permits_match_status_check'
      AND conrelid = 'public.arrival_permits'::regclass
  ) THEN
    ALTER TABLE public.arrival_permits
      ADD CONSTRAINT arrival_permits_match_status_check
      CHECK (match_status IN ('matched', 'unmatched'));
  END IF;
END $$;

-- ============================================================
-- 6.3: Drop legacy duplicate trigger and function
-- ============================================================
DROP TRIGGER IF EXISTS on_rsvp_update_invitation ON public.arrival_permits;
DROP FUNCTION IF EXISTS public.sync_rsvp_to_invitations();

-- ============================================================
-- 6.4: Remove legacy Google Sheets webhook trigger
-- ============================================================
DROP TRIGGER IF EXISTS sheets_sync_trigger ON public.arrival_permits;

-- ============================================================
-- 6.2: Rewrite sync trigger with inclusive logic + trigger guard
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_arrival_to_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
  v_core   text;
  v_inv_id uuid;
BEGIN
  -- ── Trigger guard ──────────────────────────────────────────
  -- If an admin has already resolved this permit (via RPC),
  -- skip phone-matching so we don't overwrite their choice.
  IF NEW.match_status = 'matched' AND NEW.invitation_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- ── Phone normalisation ────────────────────────────────────
  v_digits := regexp_replace(NEW.phone, '\D', '', 'g');
  v_core   := phone_core(v_digits);

  -- ── Try to find a matching invitation ──────────────────────
  SELECT id INTO v_inv_id
  FROM invitations
  WHERE event_id = NEW.event_id
    AND EXISTS (
      SELECT 1 FROM unnest(phone_numbers) AS pn
      WHERE phone_core(regexp_replace(pn, '\D', '', 'g')) = v_core
    )
  LIMIT 1;

  IF v_inv_id IS NOT NULL THEN
    -- Matched: update the invitation with RSVP data
    UPDATE invitations
    SET
      rsvp_status   = CASE WHEN NEW.attending THEN 'attending' ELSE 'declined' END,
      confirmed_pax = CASE WHEN NEW.attending THEN COALESCE(NEW.guests_count, 0) ELSE 0 END,
      updated_at    = now()
    WHERE id = v_inv_id;

    -- Tag the arrival_permit as matched
    NEW.invitation_id := v_inv_id;
    NEW.match_status  := 'matched';
  ELSE
    -- Unmatched: allow the insert, flag for admin review
    NEW.invitation_id := NULL;
    NEW.match_status  := 'unmatched';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is BEFORE (idempotent re-create)
DROP TRIGGER IF EXISTS sync_arrival_to_invitation ON public.arrival_permits;
CREATE TRIGGER sync_arrival_to_invitation
  BEFORE INSERT OR UPDATE ON public.arrival_permits
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_arrival_to_invitation();

-- ============================================================
-- 6.5: RPC — link_permit_to_invitation (atomic resolution)
-- ============================================================
CREATE OR REPLACE FUNCTION public.link_permit_to_invitation(
  p_permit_id bigint,
  p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attending    boolean;
  v_guests_count smallint;
BEGIN
  -- Read permit data (only if still unmatched)
  SELECT attending, guests_count
  INTO v_attending, v_guests_count
  FROM arrival_permits
  WHERE id = p_permit_id
    AND match_status = 'unmatched';

  IF NOT FOUND THEN
    -- Already resolved or doesn't exist — idempotent no-op
    RETURN;
  END IF;

  -- Verify the target invitation exists
  IF NOT EXISTS (SELECT 1 FROM invitations WHERE id = p_invitation_id) THEN
    RAISE EXCEPTION 'Invitation % not found', p_invitation_id;
  END IF;

  -- Update the invitation with RSVP data
  UPDATE invitations
  SET
    rsvp_status   = CASE WHEN v_attending THEN 'attending' ELSE 'declined' END,
    confirmed_pax = CASE WHEN v_attending THEN COALESCE(v_guests_count, 0) ELSE 0 END,
    updated_at    = now()
  WHERE id = p_invitation_id;

  -- Mark the permit as resolved (trigger guard will skip re-matching)
  UPDATE arrival_permits
  SET
    invitation_id = p_invitation_id,
    match_status  = 'matched'
  WHERE id = p_permit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_permit_to_invitation(bigint, uuid) TO authenticated;

-- ============================================================
-- 6.6: RPC — create_invitation_from_permit (atomic resolution)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_invitation_from_permit(
  p_permit_id bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permit       record;
  v_new_inv_id   uuid;
BEGIN
  -- Read permit data (only if still unmatched)
  SELECT event_id, full_name, phone, attending, guests_count
  INTO v_permit
  FROM arrival_permits
  WHERE id = p_permit_id
    AND match_status = 'unmatched';

  IF NOT FOUND THEN
    -- Already resolved or doesn't exist — idempotent, return NULL
    RETURN NULL;
  END IF;

  -- Create a new invitation from the permit data
  INSERT INTO invitations (
    event_id,
    group_name,
    phone_numbers,
    rsvp_status,
    confirmed_pax,
    invited_pax
  ) VALUES (
    v_permit.event_id,
    v_permit.full_name,
    ARRAY[v_permit.phone],
    CASE WHEN v_permit.attending THEN 'attending' ELSE 'declined' END,
    CASE WHEN v_permit.attending THEN COALESCE(v_permit.guests_count, 0) ELSE 0 END,
    COALESCE(v_permit.guests_count, 1)
  )
  RETURNING id INTO v_new_inv_id;

  -- Mark the permit as resolved (trigger guard will skip re-matching)
  UPDATE arrival_permits
  SET
    invitation_id = v_new_inv_id,
    match_status  = 'matched'
  WHERE id = p_permit_id;

  RETURN v_new_inv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invitation_from_permit(bigint) TO authenticated;
