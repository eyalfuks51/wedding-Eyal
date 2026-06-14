-- ═══════════════════════════════════════════════════════════════════════
-- RPC hardening: revoke anon EXECUTE + enforce event ownership on mutators
--
-- PROBLEM (pre-migration live state):
--   Every mutation RPC was executable by `anon` (EXECUTE granted to anon,
--   authenticated, postgres, service_role). The config mutators
--   (toggle_auto_pilot, update_whatsapp_template, delete_dynamic_nudge,
--   create_invitation_from_permit, link_permit_to_invitation) performed NO
--   ownership check — any anonymous caller could flip autopilot, rewrite
--   WhatsApp templates, delete nudges, or mutate invitations for ANY event
--   just by knowing/guessing an event_id. Internal helper/trigger functions
--   (handle_new_auth_user, sync_arrival_to_invitation, phone_core) were also
--   needlessly exposed to clients.
--
-- FIX:
--   1. user_can_manage_event(uuid) — shared authorization predicate
--      (event membership via user_events OR users.is_super_admin).
--   2. Revoke direct EXECUTE from anon/PUBLIC on all mutators + onboarding,
--      and from anon/authenticated/PUBLIC on internal-only functions.
--      service_role and postgres retain EXECUTE; SECURITY DEFINER functions
--      and triggers continue to run as owner, so the scheduler / triggers
--      are unaffected.
--   3. Add an ownership/authorization guard to the five config mutators.
--      (create_onboarding_event already enforces auth.uid() IS NOT NULL.)
--
-- Paired rollback: supabase/rollback/20260614120100_rpc_revoke_anon_and_ownership.down.sql
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Shared authorization predicate ──────────────────────────────────
-- SECURITY DEFINER so it can evaluate user_events / users regardless of the
-- caller's own RLS. auth.uid() reflects the real session user even when
-- called from inside another SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.user_can_manage_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM user_events ue
      WHERE ue.event_id = p_event_id AND ue.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    );
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_manage_event(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_can_manage_event(uuid) TO authenticated;

-- ── 2. Revoke anon (and tighten internal) EXECUTE grants ───────────────
-- Config mutators + onboarding: client-callable, but only by authenticated.
REVOKE EXECUTE ON FUNCTION public.toggle_auto_pilot(uuid, boolean)                         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_whatsapp_template(uuid, text, text, text)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_dynamic_nudge(uuid)                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_invitation_from_permit(bigint)                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_permit_to_invitation(bigint, uuid)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_onboarding_event(text, text, jsonb, text, text, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.toggle_auto_pilot(uuid, boolean)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_whatsapp_template(uuid, text, text, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_dynamic_nudge(uuid)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invitation_from_permit(bigint)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_permit_to_invitation(bigint, uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_onboarding_event(text, text, jsonb, text, text, date) TO authenticated;

-- Internal-only helpers/triggers: no client should call these directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_arrival_to_invitation()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.phone_core(text)             FROM PUBLIC, anon, authenticated;

-- ── 3. Add ownership guards to the config mutators ─────────────────────
-- Bodies are reproduced verbatim from the live definitions, with an
-- authorization guard prepended (or inserted after event_id resolution).

CREATE OR REPLACE FUNCTION public.toggle_auto_pilot(p_event_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION 'Not authorized for event %', p_event_id USING ERRCODE = '42501';
  END IF;

  UPDATE events
  SET automation_config = jsonb_set(
    COALESCE(automation_config, '{}'::jsonb),
    '{auto_pilot}',
    to_jsonb(p_enabled)
  )
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_whatsapp_template(
  p_event_id uuid, p_stage_name text, p_singular text, p_plural text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_stages text[] := ARRAY[
    'icebreaker', 'nudge', 'nudge_1', 'nudge_2', 'nudge_3',
    'ultimatum', 'logistics', 'hangover'
  ];
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION 'Not authorized for event %', p_event_id USING ERRCODE = '42501';
  END IF;

  IF p_stage_name != ALL(v_allowed_stages) THEN
    RAISE EXCEPTION 'Invalid stage_name: %', p_stage_name;
  END IF;

  UPDATE events
  SET content_config = jsonb_set(
    CASE
      WHEN content_config -> 'whatsapp_templates' IS NULL
      THEN jsonb_set(COALESCE(content_config, '{}'::jsonb), '{whatsapp_templates}', '{}'::jsonb)
      ELSE content_config
    END,
    ARRAY['whatsapp_templates', p_stage_name],
    jsonb_build_object('singular', p_singular, 'plural', p_plural),
    true
  )
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_dynamic_nudge(p_setting_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage     text;
  v_event_id  uuid;
  v_log_count bigint;
BEGIN
  SELECT stage_name, event_id INTO v_stage, v_event_id
  FROM automation_settings WHERE id = p_setting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Setting not found: %', p_setting_id;
  END IF;

  IF auth.uid() IS NULL OR NOT public.user_can_manage_event(v_event_id) THEN
    RAISE EXCEPTION 'Not authorized for event %', v_event_id USING ERRCODE = '42501';
  END IF;

  -- Only dynamic nudges (nudge_1, nudge_2, nudge_3) can be deleted
  IF v_stage NOT LIKE 'nudge_%' THEN
    RAISE EXCEPTION 'Cannot delete canonical stage: %', v_stage;
  END IF;

  -- Guard: block deletion if any messages were ever queued
  SELECT count(*) INTO v_log_count
  FROM message_logs
  WHERE event_id = v_event_id AND message_type = v_stage;

  IF v_log_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % messages already exist for stage %', v_log_count, v_stage;
  END IF;

  DELETE FROM automation_settings WHERE id = p_setting_id;

  -- Also clean up the whatsapp_templates key if it exists
  UPDATE events
  SET content_config = content_config #- ARRAY['whatsapp_templates', v_stage]
  WHERE id = v_event_id
    AND content_config -> 'whatsapp_templates' ? v_stage;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invitation_from_permit(p_permit_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permit     record;
  v_new_inv_id uuid;
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

  IF auth.uid() IS NULL OR NOT public.user_can_manage_event(v_permit.event_id) THEN
    RAISE EXCEPTION 'Not authorized for event %', v_permit.event_id USING ERRCODE = '42501';
  END IF;

  -- Create a new invitation from the permit data
  INSERT INTO invitations (
    event_id, group_name, phone_numbers, rsvp_status, confirmed_pax, invited_pax
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
  SET invitation_id = v_new_inv_id, match_status = 'matched'
  WHERE id = p_permit_id;

  RETURN v_new_inv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_permit_to_invitation(
  p_permit_id bigint, p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id     uuid;
  v_inv_event_id uuid;
  v_attending    boolean;
  v_guests_count smallint;
BEGIN
  -- Read permit data (only if still unmatched)
  SELECT event_id, attending, guests_count
  INTO v_event_id, v_attending, v_guests_count
  FROM arrival_permits
  WHERE id = p_permit_id
    AND match_status = 'unmatched';

  IF NOT FOUND THEN
    -- Already resolved or doesn't exist — idempotent no-op
    RETURN;
  END IF;

  IF auth.uid() IS NULL OR NOT public.user_can_manage_event(v_event_id) THEN
    RAISE EXCEPTION 'Not authorized for event %', v_event_id USING ERRCODE = '42501';
  END IF;

  -- Load the target invitation's event and require it to be the SAME event as
  -- the permit. Without this, an owner of event A could pass an invitation UUID
  -- belonging to event B and mutate another tenant's invitation (the ownership
  -- check above only covers the permit's event, not the invitation's).
  SELECT event_id INTO v_inv_event_id FROM invitations WHERE id = p_invitation_id;
  IF v_inv_event_id IS NULL THEN
    RAISE EXCEPTION 'Invitation % not found', p_invitation_id;
  END IF;
  IF v_inv_event_id <> v_event_id THEN
    RAISE EXCEPTION 'Invitation % does not belong to event %', p_invitation_id, v_event_id
      USING ERRCODE = '42501';
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
  SET invitation_id = p_invitation_id, match_status = 'matched'
  WHERE id = p_permit_id;
END;
$$;
