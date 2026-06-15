-- Rollback for 20260615120000_automation_settings_insert_ownership.sql
-- Faithful inverse: restores the original whitelist-only INSERT policy exactly as
-- it existed after 20260302100100 (no ownership check).
--
-- WARNING: applying this rollback RE-OPENS the cross-tenant INSERT hole described
-- in the forward migration. It exists only to return automation_settings to its
-- precise prior policy state.

DROP POLICY IF EXISTS "Authenticated users can insert automation_settings"
  ON public.automation_settings;

CREATE POLICY "Authenticated users can insert automation_settings"
  ON public.automation_settings FOR INSERT TO authenticated
  WITH CHECK (
    stage_name IN (
      'icebreaker','nudge','nudge_1','nudge_2','nudge_3',
      'ultimatum','logistics','hangover'
    )
  );
