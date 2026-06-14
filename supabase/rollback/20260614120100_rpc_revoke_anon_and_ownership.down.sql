-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK for 20260614120100_rpc_revoke_anon_and_ownership.sql
--
-- Restores PRE-migration EXECUTE grants (anon + authenticated on all RPCs)
-- and the guard-free function bodies. NOTE: re-opens the anon-mutation holes
-- — recovery use only.
-- ═══════════════════════════════════════════════════════════════════════

-- Restore guard-free bodies (verbatim live definitions captured 2026-06-14)
CREATE OR REPLACE FUNCTION public.toggle_auto_pilot(p_event_id uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE events
  SET automation_config = jsonb_set(
    COALESCE(automation_config, '{}'::jsonb), '{auto_pilot}', to_jsonb(p_enabled))
  WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_whatsapp_template(
  p_event_id uuid, p_stage_name text, p_singular text, p_plural text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_allowed_stages text[] := ARRAY['icebreaker','nudge','nudge_1','nudge_2','nudge_3','ultimatum','logistics','hangover'];
BEGIN
  IF p_stage_name != ALL(v_allowed_stages) THEN
    RAISE EXCEPTION 'Invalid stage_name: %', p_stage_name;
  END IF;
  UPDATE events
  SET content_config = jsonb_set(
    CASE WHEN content_config -> 'whatsapp_templates' IS NULL
      THEN jsonb_set(COALESCE(content_config, '{}'::jsonb), '{whatsapp_templates}', '{}'::jsonb)
      ELSE content_config END,
    ARRAY['whatsapp_templates', p_stage_name],
    jsonb_build_object('singular', p_singular, 'plural', p_plural), true)
  WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_dynamic_nudge(p_setting_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stage text; v_event_id uuid; v_log_count bigint;
BEGIN
  SELECT stage_name, event_id INTO v_stage, v_event_id FROM automation_settings WHERE id = p_setting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Setting not found: %', p_setting_id;
  END IF;
  IF v_stage NOT LIKE 'nudge_%' THEN
    RAISE EXCEPTION 'Cannot delete canonical stage: %', v_stage;
  END IF;
  SELECT count(*) INTO v_log_count FROM message_logs WHERE event_id = v_event_id AND message_type = v_stage;
  IF v_log_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % messages already exist for stage %', v_log_count, v_stage;
  END IF;
  DELETE FROM automation_settings WHERE id = p_setting_id;
  UPDATE events SET content_config = content_config #- ARRAY['whatsapp_templates', v_stage]
  WHERE id = v_event_id AND content_config -> 'whatsapp_templates' ? v_stage;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invitation_from_permit(p_permit_id bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_permit record; v_new_inv_id uuid;
BEGIN
  SELECT event_id, full_name, phone, attending, guests_count INTO v_permit
  FROM arrival_permits WHERE id = p_permit_id AND match_status = 'unmatched';
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO invitations (event_id, group_name, phone_numbers, rsvp_status, confirmed_pax, invited_pax)
  VALUES (
    v_permit.event_id, v_permit.full_name, ARRAY[v_permit.phone],
    CASE WHEN v_permit.attending THEN 'attending' ELSE 'declined' END,
    CASE WHEN v_permit.attending THEN COALESCE(v_permit.guests_count, 0) ELSE 0 END,
    COALESCE(v_permit.guests_count, 1))
  RETURNING id INTO v_new_inv_id;
  UPDATE arrival_permits SET invitation_id = v_new_inv_id, match_status = 'matched' WHERE id = p_permit_id;
  RETURN v_new_inv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_permit_to_invitation(p_permit_id bigint, p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attending boolean; v_guests_count smallint;
BEGIN
  SELECT attending, guests_count INTO v_attending, v_guests_count
  FROM arrival_permits WHERE id = p_permit_id AND match_status = 'unmatched';
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM invitations WHERE id = p_invitation_id) THEN
    RAISE EXCEPTION 'Invitation % not found', p_invitation_id;
  END IF;
  UPDATE invitations
  SET rsvp_status = CASE WHEN v_attending THEN 'attending' ELSE 'declined' END,
      confirmed_pax = CASE WHEN v_attending THEN COALESCE(v_guests_count, 0) ELSE 0 END,
      updated_at = now()
  WHERE id = p_invitation_id;
  UPDATE arrival_permits SET invitation_id = p_invitation_id, match_status = 'matched' WHERE id = p_permit_id;
END;
$$;

-- Restore original broad EXECUTE grants (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.toggle_auto_pilot(uuid, boolean)                         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_whatsapp_template(uuid, text, text, text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_dynamic_nudge(uuid)                               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invitation_from_permit(bigint)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_permit_to_invitation(bigint, uuid)                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_onboarding_event(text, text, jsonb, text, text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user()       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_arrival_to_invitation() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_core(text)             TO anon, authenticated;

-- Drop the authorization helper
DROP FUNCTION IF EXISTS public.user_can_manage_event(uuid);
