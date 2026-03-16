-- ═══════════════════════════════════════════════════════════════
-- Fix: Ensure authenticated users can INSERT events (onboarding)
-- ═══════════════════════════════════════════════════════════════
-- The policy was defined in 20260302100100 but may not have been
-- applied to production. This migration is idempotent.
--
-- Also creates an RPC for onboarding that atomically inserts the
-- event AND the user_events link in a single SECURITY DEFINER
-- call, avoiding the chicken-and-egg RLS problem where .select()
-- after .insert() fails because no user_events row exists yet.
-- ═══════════════════════════════════════════════════════════════

-- 1. Idempotent re-create of the INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert events" ON events;
CREATE POLICY "Authenticated users can insert events"
  ON events FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. RPC: create_onboarding_event
--    Inserts the event row + user_events link atomically.
--    Returns the new event id and slug.
CREATE OR REPLACE FUNCTION create_onboarding_event(
  p_slug          text,
  p_template_id   text,
  p_content_config jsonb,
  p_partner1_name text DEFAULT NULL,
  p_partner2_name text DEFAULT NULL,
  p_event_date    date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_user_id  uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO events (slug, template_id, content_config, status, partner1_name, partner2_name, event_date)
  VALUES (p_slug, p_template_id, p_content_config, 'draft', p_partner1_name, p_partner2_name, p_event_date)
  RETURNING id INTO v_event_id;

  INSERT INTO user_events (user_id, event_id, role)
  VALUES (v_user_id, v_event_id, 'owner');

  RETURN jsonb_build_object('id', v_event_id, 'slug', p_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION create_onboarding_event(text, text, jsonb, text, text, date) TO authenticated;
