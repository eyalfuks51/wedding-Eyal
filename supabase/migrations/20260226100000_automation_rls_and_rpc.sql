-- ═══════════════════════════════════════════════════════════════════════
-- 1. RLS policies for automation_settings (anon read + update)
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "Allow anon select automation_settings"
  ON automation_settings FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon update automation_settings"
  ON automation_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Secure RPC: atomically patch ONE whatsapp_template stage
--    Uses jsonb_set — no full-row replacement, no race conditions.
--    Does NOT require anon UPDATE on events.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_whatsapp_template(
  p_event_id   uuid,
  p_stage_name text,
  p_singular   text,
  p_plural     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER          -- runs with table-owner privileges
SET search_path = public  -- prevent search_path hijacking
AS $$
DECLARE
  v_allowed_stages text[] := ARRAY[
    'icebreaker', 'nudge', 'ultimatum', 'logistics', 'hangover'
  ];
BEGIN
  -- Validate stage_name against the allowed whitelist
  IF p_stage_name != ALL(v_allowed_stages) THEN
    RAISE EXCEPTION 'Invalid stage_name: %', p_stage_name;
  END IF;

  -- Atomic JSONB patch: sets content_config -> 'whatsapp_templates' -> <stage> -> { singular, plural }
  -- If whatsapp_templates key doesn't exist yet, initialise it as an empty object first.
  UPDATE events
  SET content_config = jsonb_set(
    -- Ensure the whatsapp_templates parent key exists
    CASE
      WHEN content_config -> 'whatsapp_templates' IS NULL
      THEN jsonb_set(COALESCE(content_config, '{}'::jsonb), '{whatsapp_templates}', '{}'::jsonb)
      ELSE content_config
    END,
    -- Path: whatsapp_templates -> <stage_name>
    ARRAY['whatsapp_templates', p_stage_name],
    -- Value: { "singular": "...", "plural": "..." }
    jsonb_build_object('singular', p_singular, 'plural', p_plural),
    -- create_if_missing
    true
  )
  WHERE id = p_event_id;

  -- Verify the row was actually found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
END;
$$;

-- Grant execute to anon so the frontend can call it via supabase.rpc()
GRANT EXECUTE ON FUNCTION update_whatsapp_template(uuid, text, text, text) TO anon;
