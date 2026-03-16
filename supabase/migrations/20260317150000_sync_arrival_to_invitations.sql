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
BEGIN
  UPDATE invitations
  SET
    rsvp_status   = CASE WHEN NEW.attending THEN 'attending' ELSE 'declined' END,
    confirmed_pax = COALESCE(NEW.guests_count, 0)
  WHERE event_id = NEW.event_id
    AND NEW.phone = ANY(phone_numbers);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_arrival_to_invitation ON arrival_permits;
CREATE TRIGGER sync_arrival_to_invitation
  AFTER INSERT OR UPDATE ON arrival_permits
  FOR EACH ROW EXECUTE FUNCTION public.sync_arrival_to_invitation();
