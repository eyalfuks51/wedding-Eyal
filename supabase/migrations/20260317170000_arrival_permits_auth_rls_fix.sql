-- Fix: arrival_permits RLS policies only existed for anon.
-- If a user is authenticated (e.g. admin testing the RSVP form while logged in),
-- the upsert fails because there are no INSERT/UPDATE/SELECT policies for authenticated.
-- Solution: add equivalent policies for authenticated role.

CREATE POLICY "Allow authenticated select arrival_permits"
  ON public.arrival_permits
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert arrival_permits"
  ON public.arrival_permits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update arrival_permits"
  ON public.arrival_permits
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
