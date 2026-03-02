-- ═══════════════════════════════════════════════════════════════
-- Auth & Multi-Tenancy — Schema
-- ═══════════════════════════════════════════════════════════════

-- 1. Add status to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
-- Immediately activate the existing event so production is unaffected
UPDATE events SET status = 'active' WHERE slug = 'hagit-and-itai';

-- 2. Create public.users (mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  full_name  text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create user_events join table
CREATE TABLE IF NOT EXISTS public.user_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'co-owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

-- 4. Trigger: auto-insert a users row when a new auth.users row is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
