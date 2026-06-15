-- P0 hardening: add ownership check to the automation_settings INSERT policy.
--
-- Problem: the live "Authenticated users can insert automation_settings" policy
-- (from 20260302100100) gated INSERT only on the stage_name whitelist, with NO
-- user_events ownership check -- unlike the sibling SELECT/UPDATE policies, which
-- both require user_events membership. Because permissive policies OR-merge, any
-- authenticated user who knows another event's id (event ids are returned to the
-- public client by fetchEventBySlug) could INSERT active automation stages for
-- THAT event, with attacker-chosen days_before/target_status. The service-role
-- automation-engine processes all active automation_settings, so this is a
-- cross-tenant WhatsApp-injection vector once the WhatsApp channel is open.
--
-- Fix: drop and recreate the INSERT policy to also require user_events ownership,
-- mirroring the SELECT/UPDATE policies. The stage_name whitelist is preserved.
-- The separate "Super admins can insert automation_settings" policy is unchanged
-- (super admins keep their is_super_admin INSERT path via OR-merge).
--
-- Legitimate path unaffected: addDynamicNudge (src/lib/supabase.js) inserts as the
-- authenticated owner with a whitelisted nudge_* stage for their own event_id, so
-- it satisfies both the whitelist AND the new ownership check.

DROP POLICY IF EXISTS "Authenticated users can insert automation_settings"
  ON public.automation_settings;

CREATE POLICY "Authenticated users can insert automation_settings"
  ON public.automation_settings FOR INSERT TO authenticated
  WITH CHECK (
    stage_name IN (
      'icebreaker','nudge','nudge_1','nudge_2','nudge_3',
      'ultimatum','logistics','hangover'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = automation_settings.event_id AND ue.user_id = auth.uid()
    )
  );
