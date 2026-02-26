-- ═══════════════════════════════════════════════════════════════════════
-- Dynamic Nudges + Auto-Pilot — Migration
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Allow anon INSERT on automation_settings (for adding dynamic nudges)
--    WITH CHECK enforces the allowed stage_name whitelist server-side.
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "Allow anon insert automation_settings"
  ON automation_settings FOR INSERT TO anon
  WITH CHECK (
    stage_name IN (
      'icebreaker', 'nudge', 'nudge_1', 'nudge_2', 'nudge_3',
      'ultimatum', 'logistics', 'hangover'
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Secure RPC: delete a dynamic nudge ONLY if no messages exist
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION delete_dynamic_nudge(p_setting_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage    text;
  v_event_id uuid;
  v_log_count bigint;
BEGIN
  SELECT stage_name, event_id INTO v_stage, v_event_id
  FROM automation_settings WHERE id = p_setting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Setting not found: %', p_setting_id;
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

GRANT EXECUTE ON FUNCTION delete_dynamic_nudge(uuid) TO anon;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Secure RPC: toggle Auto-Pilot flag in automation_config
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION toggle_auto_pilot(p_event_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

GRANT EXECUTE ON FUNCTION toggle_auto_pilot(uuid, boolean) TO anon;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Extend update_whatsapp_template whitelist to include dynamic nudges
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_whatsapp_template(
  p_event_id   uuid,
  p_stage_name text,
  p_singular   text,
  p_plural     text
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
