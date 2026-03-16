-- ═══════════════════════════════════════════════════════════════
-- Trigger: sync arrival_permits → invitations
-- ═══════════════════════════════════════════════════════════════
-- When a guest submits an RSVP (INSERT/UPDATE on arrival_permits),
-- find the matching invitation by phone number and event_id,
-- then update rsvp_status and confirmed_pax.
-- ═══════════════════════════════════════════════════════════════

-- Helper: strip phone to core digits (no 972 prefix, no leading 0)
-- "972522937174" → "522937174", "0522937174" → "522937174", "522937174" → "522937174"
CREATE OR REPLACE FUNCTION public.phone_core(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p LIKE '972%' THEN substring(p from 4)
    WHEN p LIKE '0%'   THEN substring(p from 2)
    ELSE p
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_arrival_to_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(NEW.phone, '\D', '', 'g');
  v_core   text := phone_core(v_digits);
BEGIN
  UPDATE invitations
  SET
    rsvp_status   = CASE WHEN NEW.attending THEN 'attending' ELSE 'declined' END,
    confirmed_pax = COALESCE(NEW.guests_count, 0)
  WHERE event_id = NEW.event_id
    AND EXISTS (
      SELECT 1 FROM unnest(phone_numbers) AS pn
      WHERE phone_core(regexp_replace(pn, '\D', '', 'g')) = v_core
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_arrival_to_invitation ON arrival_permits;
CREATE TRIGGER sync_arrival_to_invitation
  AFTER INSERT OR UPDATE ON arrival_permits
  FOR EACH ROW EXECUTE FUNCTION public.sync_arrival_to_invitation();
