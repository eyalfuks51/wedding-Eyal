-- Seed the 5 funnel stages for the 'hagit-and-itai' event.
-- Uses a subselect to resolve the event_id from the slug.
-- Safe to re-run: the NOT EXISTS guard skips rows that already exist.

INSERT INTO automation_settings (event_id, stage_name, days_before, target_status, is_active)
SELECT
  e.id,
  stage.stage_name,
  stage.days_before,
  stage.target_status,
  stage.is_active
FROM events e
CROSS JOIN (VALUES
  ('icebreaker', 14, 'pending',   true),
  ('nudge',       7, 'pending',   true),
  ('ultimatum',   3, 'pending',   true),
  ('logistics',   1, 'attending', true),
  ('hangover',   -1, 'attending', true)
) AS stage(stage_name, days_before, target_status, is_active)
WHERE e.slug = 'hagit-and-itai'
  AND NOT EXISTS (
    SELECT 1 FROM automation_settings a
    WHERE a.event_id = e.id AND a.stage_name = stage.stage_name
  );
