-- Rollback for 20260615140100_user_events_revoke_self_grant.sql
-- Faithful inverse: restores the client INSERT table grant to anon and
-- authenticated (both held it pre-fix) and recreates the original whitelist-free
-- INSERT policy exactly as it existed prior.
--
-- WARNING: applying this rollback RE-OPENS the self-grant ownership hole (any
-- authenticated user can forge user_events membership for any event). It exists
-- only to return public.user_events to its precise prior policy + grant state.

GRANT INSERT ON public.user_events TO anon, authenticated;

CREATE POLICY "Users can insert own event memberships"
  ON public.user_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
