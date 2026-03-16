-- ═══════════════════════════════════════════════════════════════
-- Trigger: sync arrival_permits → invitations
-- ═══════════════════════════════════════════════════════════════
-- When a guest submits an RSVP (INSERT/UPDATE on arrival_permits),
-- find the matching invitation by phone number and event_id,
-- then update rsvp_status and confirmed_pax.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_arrival_to_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := regexp_replace(NEW.phone, '\D', '', 'g');
  v_normalized text;
BEGIN
  -- Normalize to 972-prefix (same as guest-excel.ts normalizePhone)
  IF v_phone LIKE '972%' THEN
    v_normalized := v_phone;
  ELSIF v_phone LIKE '0%' THEN
    v_normalized := '972' || substring(v_phone from 2);
  ELSE
    v_normalized := v_phone;
  END IF;

  UPDATE invitations
  SET
    rsvp_status   = CASE WHEN NEW.attending THEN 'attending' ELSE 'declined' END,
    confirmed_pax = COALESCE(NEW.guests_count, 0)
  WHERE event_id = NEW.event_id
    AND (v_normalized = ANY(phone_numbers) OR v_phone = ANY(phone_numbers));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_arrival_to_invitation ON arrival_permits;
CREATE TRIGGER sync_arrival_to_invitation
  AFTER INSERT OR UPDATE ON arrival_permits
  FOR EACH ROW EXECUTE FUNCTION public.sync_arrival_to_invitation();
