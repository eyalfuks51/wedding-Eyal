# Auth & Multi-Tenancy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google OAuth login, multi-tenant event ownership, and draft/active feature gating to the Wedding RSVP Platform.

**Architecture:** Supabase Auth handles Google OAuth. A `users` table mirrors `auth.users` via a Postgres trigger. A `user_events` join table controls which users can access which events. RLS policies enforce data isolation at the DB layer. All three dashboard pages consume an `EventContext` instead of the hardcoded `'hagit-and-itai'` slug.

**Tech Stack:** React + TypeScript, Supabase Auth (Google OAuth provider), Supabase RLS, React Context API, React Router v6, Tailwind CSS.

---

## Pre-Requisites (Manual — Do Before Coding)

1. Supabase Dashboard → Authentication → Providers → enable **Google**
2. Google Cloud Console → create OAuth 2.0 credentials, add authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Paste Google Client ID + Secret into Supabase Auth settings → Save

---

### Task 1: DB Migration — Event Status, Users, User Events

**Files:**
- Create: `supabase/migrations/20260302100000_auth_multitenant_schema.sql`

**Step 1: Write the migration**

```sql
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
```

**Step 2: Apply migration**

```bash
cd /c/dev/github/personal/Wedding-Eyal
npx supabase db push
```

Expected: completes without errors.

**Step 3: Verify in Supabase dashboard**
- `events` has a `status` column; `hagit-and-itai` row shows `status = 'active'`
- `public.users` table exists (empty until first login)
- `public.user_events` table exists
- Trigger `on_auth_user_created` listed under `auth.users` triggers

**Step 4: Commit**

```bash
git add supabase/migrations/20260302100000_auth_multitenant_schema.sql
git commit -m "feat(auth): add event status, users, user_events tables + auth trigger"
```

---

### Task 2: DB Migration — RLS Policies for Authenticated Users

**Files:**
- Create: `supabase/migrations/20260302100100_auth_rls_policies.sql`

**Context:** Currently `automation_settings` has broad anon SELECT/UPDATE/INSERT policies. `events`, `invitations`, and `message_logs` have no explicit anon data policies (writes go via SECURITY DEFINER RPCs). This migration replaces all of that with `authenticated`-role policies. `arrival_permits` anon policies are untouched — RSVP guests are not logged in.

**Step 1: Write the migration**

```sql
-- ═══════════════════════════════════════════════════════════════
-- Auth RLS Policies — Dashboard Tables
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on the new tables
ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- Enable RLS on dashboard tables that may not have it yet
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs      ENABLE ROW LEVEL SECURITY;

-- ── users ──────────────────────────────────────────────────────
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ── user_events ────────────────────────────────────────────────
CREATE POLICY "Users can view own event memberships"
  ON public.user_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own event memberships"
  ON public.user_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── events ─────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can select their events"
  ON events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = events.id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update their events"
  ON events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = events.id AND ue.user_id = auth.uid()
    )
  );

-- Needed for onboarding wizard to insert the new event row
CREATE POLICY "Authenticated users can insert events"
  ON events FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── invitations ────────────────────────────────────────────────
CREATE POLICY "Authenticated users can select invitations"
  ON invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = invitations.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert invitations"
  ON invitations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = invitations.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update invitations"
  ON invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = invitations.event_id AND ue.user_id = auth.uid()
    )
  );

-- ── message_logs ───────────────────────────────────────────────
CREATE POLICY "Authenticated users can select message logs"
  ON message_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = message_logs.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert message logs"
  ON message_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = message_logs.event_id AND ue.user_id = auth.uid()
    )
  );

-- ── automation_settings: replace anon with authenticated ───────
DROP POLICY IF EXISTS "Allow anon select automation_settings"  ON automation_settings;
DROP POLICY IF EXISTS "Allow anon update automation_settings"  ON automation_settings;
DROP POLICY IF EXISTS "Allow anon insert automation_settings"  ON automation_settings;

CREATE POLICY "Authenticated users can select automation_settings"
  ON automation_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = automation_settings.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update automation_settings"
  ON automation_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = automation_settings.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert automation_settings"
  ON automation_settings FOR INSERT TO authenticated
  WITH CHECK (
    stage_name IN (
      'icebreaker','nudge','nudge_1','nudge_2','nudge_3',
      'ultimatum','logistics','hangover'
    )
  );

-- ── Grant RPC execute to authenticated ────────────────────────
-- (Previously only anon; authenticated users need these for the dashboard)
GRANT EXECUTE ON FUNCTION update_whatsapp_template(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_auto_pilot(uuid, boolean)                  TO authenticated;
GRANT EXECUTE ON FUNCTION delete_dynamic_nudge(uuid)                        TO authenticated;
```

**Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: completes without errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260302100100_auth_rls_policies.sql
git commit -m "feat(auth): replace broad anon RLS with authenticated user policies on all dashboard tables"
```

---

### Task 3: Auth Helpers in supabase.js

**Files:**
- Modify: `src/lib/supabase.js` (append at end — do NOT touch existing functions)

**Step 1: Append these two functions**

```js
/**
 * Fetch the event linked to the currently authenticated user.
 * Returns null if the user has no event yet (new user → show onboarding).
 */
export const fetchEventForUser = async () => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('user_events')
    .select('role, events(id, slug, template_id, content_config, event_date, automation_config, status)')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.events ?? null;
};

/**
 * Create a new draft event and link it to the currently authenticated user.
 * Called at the end of the onboarding wizard.
 */
export const createOnboardingEvent = async ({ slug, templateId, contentConfig }) => {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({ slug, template_id: templateId, content_config: contentConfig, status: 'draft' })
    .select('id')
    .single();
  if (eventError) throw eventError;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Not authenticated');

  const { error: linkError } = await supabase
    .from('user_events')
    .insert({ user_id: user.id, event_id: event.id, role: 'owner' });
  if (linkError) throw linkError;

  return event;
};
```

**Step 2: Commit**

```bash
git add src/lib/supabase.js
git commit -m "feat(auth): add fetchEventForUser and createOnboardingEvent to supabase.js"
```

---

### Task 4: AuthContext

**Files:**
- Create: `src/contexts/AuthContext.tsx`

**Step 1: Create the file**

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  user:    User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase!.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase!.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
```

**Step 2: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat(auth): add AuthContext with Supabase Google OAuth session management"
```

---

### Task 5: EventContext

**Files:**
- Create: `src/contexts/EventContext.tsx`

**Step 1: Create the file**

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchEventForUser } from '@/lib/supabase';

export interface EventData {
  id:               string;
  slug:             string;
  template_id:      string;
  content_config:   Record<string, unknown> | null;
  event_date:       string | null;
  automation_config: Record<string, unknown> | null;
  status:           'draft' | 'active';
}

interface EventContextValue {
  event:     EventData | null;
  isActive:  boolean;
  isLoading: boolean;
  refetch:   () => void;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const [event, setEvent]       = useState<EventData | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [tick, setTick]         = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEventForUser()
      .then(data  => { if (!cancelled) { setEvent(data as EventData | null); setLoading(false); } })
      .catch(()   => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tick]);

  return (
    <EventContext.Provider value={{
      event,
      isActive:  event?.status === 'active',
      isLoading,
      refetch: () => setTick(t => t + 1),
    }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEventContext(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error('useEventContext must be inside EventProvider');
  return ctx;
}
```

**Step 2: Commit**

```bash
git add src/contexts/EventContext.tsx
git commit -m "feat(auth): add EventContext that resolves the current user's event dynamically"
```

---

### Task 6: ProtectedRoute

**Files:**
- Create: `src/components/auth/ProtectedRoute.tsx`

**Step 1: Create the file**

```tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { EventProvider, useEventContext } from '@/contexts/EventContext';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRouteInner({ children }: { children: ReactNode }) {
  const { user, loading: authLoading }      = useAuth();
  const { event, isLoading: eventLoading }  = useEventContext();

  if (authLoading || eventLoading) return <Spinner />;
  if (!user)  return <Navigate to="/login"      replace />;
  if (!event) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

/**
 * Wraps all /dashboard/* routes.
 * Provides a single EventProvider so all dashboard pages share one context instance.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <EventProvider>
      <ProtectedRouteInner>{children}</ProtectedRouteInner>
    </EventProvider>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/auth/ProtectedRoute.tsx
git commit -m "feat(auth): add ProtectedRoute — auth guard + event check for dashboard routes"
```

---

### Task 7: LoginPage

**Files:**
- Create: `src/pages/LoginPage.tsx`

**Step 1: Create the file**

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Already signed in → skip login
  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  const handleGoogleLogin = async () => {
    await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center font-brand">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm text-center">
        <h1 className="font-danidin text-3xl text-slate-800 mb-2">Wedding Platform</h1>
        <p className="text-slate-500 text-sm mb-8">התחברו לניהול האירוע שלכם</p>
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5"
          />
          המשיכו עם Google
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/LoginPage.tsx
git commit -m "feat(auth): add LoginPage with Google OAuth sign-in button"
```

---

### Task 8: OnboardingPage (3-step wizard)

**Files:**
- Create: `src/pages/OnboardingPage.tsx`

**Step 1: Create the file**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOnboardingEvent } from '@/lib/supabase';

const TEMPLATES = [
  { id: 'elegant',         label: 'Elegant',        desc: 'נייבי כהה + זהב, מינימליסטי' },
  { id: 'wedding-default', label: 'Wedding Default', desc: 'בורדו/קרם, פרחים דקורטיביים' },
];

interface FormState { partner1: string; partner2: string; date: string; venue: string }

export default function OnboardingPage() {
  const navigate                        = useNavigate();
  const [step, setStep]                 = useState<1 | 2 | 3>(1);
  const [templateId, setTemplateId]     = useState('elegant');
  const [form, setForm]                 = useState<FormState>({ partner1: '', partner2: '', date: '', venue: '' });
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const base = `${form.partner1}-and-${form.partner2}`
        .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const slug = `${base}-${Date.now()}`;
      await createOnboardingEvent({
        slug,
        templateId,
        contentConfig: {
          couple_names: `${form.partner1} & ${form.partner2}`,
          date_display: form.date,
          venue_name:   form.venue,
        },
      });
      navigate('/dashboard/settings', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת האירוע');
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center font-brand p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? 'bg-violet-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 className="font-danidin text-2xl text-slate-800 mb-1">בחרו עיצוב</h2>
            <p className="text-slate-500 text-sm mb-6">ניתן לשנות בהמשך בהגדרות</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`border-2 rounded-xl p-4 text-right transition-colors ${templateId === t.id ? 'border-violet-600 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="font-medium text-slate-800 text-sm">{t.label}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-violet-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              הבא
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-danidin text-2xl text-slate-800 mb-1">פרטי האירוע</h2>
            <p className="text-slate-500 text-sm mb-6">ניתן לערוך בהמשך בהגדרות</p>
            <div className="space-y-4 mb-6">
              {([
                ['partner1', 'שם בן/בת זוג 1', 'text'],
                ['partner2', 'שם בן/בת זוג 2', 'text'],
                ['date',     'תאריך האירוע',    'date'],
                ['venue',    'שם האולם',         'text'],
              ] as const).map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-sm text-slate-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={set(key)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-medium hover:bg-slate-50">חזרה</button>
              <button
                onClick={() => setStep(3)}
                disabled={!form.partner1 || !form.partner2}
                className="flex-1 bg-violet-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                הבא
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-danidin text-2xl text-slate-800 mb-1">הכל מוכן!</h2>
            <p className="text-slate-500 text-sm mb-6">האירוע ייווצר במצב טיוטה — Preview ועריכה זמינים מיד</p>
            <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2 text-slate-600 mb-6">
              <div><span className="font-medium">עיצוב:</span> {TEMPLATES.find(t => t.id === templateId)?.label}</div>
              <div><span className="font-medium">בני הזוג:</span> {form.partner1} & {form.partner2}</div>
              {form.date  && <div><span className="font-medium">תאריך:</span> {form.date}</div>}
              {form.venue && <div><span className="font-medium">אולם:</span>   {form.venue}</div>}
            </div>
            {error && <p className="text-rose-600 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-medium hover:bg-slate-50">חזרה</button>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 bg-violet-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'יוצר...' : 'צור אירוע'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/pages/OnboardingPage.tsx
git commit -m "feat(auth): add 3-step OnboardingPage wizard for new user event creation"
```

---

### Task 9: useFeatureAccess hook

**Files:**
- Create: `src/hooks/useFeatureAccess.ts`

**Step 1: Create the file**

```ts
import { useEventContext } from '@/contexts/EventContext';

export function useFeatureAccess() {
  const { isActive } = useEventContext();
  return {
    canManageGuests: isActive,
    canUseWhatsApp:  isActive,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useFeatureAccess.ts
git commit -m "feat(auth): add useFeatureAccess hook — single source of truth for draft/active gating"
```

---

### Task 10: Wire App.jsx and main.jsx

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/main.jsx`

**Step 1: Replace the entire content of `src/App.jsx`**

```jsx
import { Routes, Route } from 'react-router-dom';
import EventPage         from './pages/EventPage';
import NotFoundPage      from './pages/NotFoundPage';
import Dashboard         from './pages/Dashboard';
import AutomationTimeline from './pages/AutomationTimeline';
import DashboardSettings  from './pages/DashboardSettings';
import LoginPage         from './pages/LoginPage';
import OnboardingPage    from './pages/OnboardingPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"      element={<LoginPage />} />
      <Route path="/preview/:slug" element={<EventPage isPreview={true} />} />
      <Route path="/:slug"      element={<EventPage />} />

      {/* Auth-required, no event needed */}
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Protected dashboard — single ProtectedRoute wraps all three tabs */}
      <Route
        path="/dashboard"
        element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/timeline"
        element={<ProtectedRoute><AutomationTimeline /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/settings"
        element={<ProtectedRoute><DashboardSettings /></ProtectedRoute>}
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
```

> **Note on EventProvider:** Each `/dashboard/*` route mounts its own `ProtectedRoute` which includes an `EventProvider`. This is intentional — each tab is a separate route mount. The fetch is fast (single row) and is cached in React state for the lifetime of the component. If you later want to share state across tabs without refetching, lift `EventProvider` above the Routes — but wait until it's needed (YAGNI).

**Step 2: Replace the entire content of `src/main.jsx`**

```jsx
import { StrictMode }    from 'react'
import { createRoot }    from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/global.scss'
import './styles/tailwind.css'
import { AuthProvider }  from './contexts/AuthContext'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

**Step 3: Commit**

```bash
git add src/App.jsx src/main.jsx
git commit -m "feat(auth): wire AuthProvider and ProtectedRoute into App and main"
```

---

### Task 11: Remove Hardcoded SLUG from Dashboard Pages

Three files have `const SLUG = 'hagit-and-itai'`. Each uses `useEvent(SLUG)` to load the event.
Replace with `useEventContext()` in all three.

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/AutomationTimeline.tsx`
- Modify: `src/pages/DashboardSettings.tsx`

**For each file, apply these changes:**

1. Delete the line: `const SLUG = 'hagit-and-itai';`

2. If the file imports `useEvent` from `@/hooks/useEvent`, remove that import line.

3. Add this import:
   ```ts
   import { useEventContext } from '@/contexts/EventContext';
   ```

4. Find the hook call — it will look like one of:
   ```ts
   const { event, loading }   = useEvent(SLUG);
   const { event, loading, notFound } = useEvent(SLUG);
   ```
   Replace it with:
   ```ts
   const { event, isLoading: loading } = useEventContext();
   ```

5. If the file used `notFound` from `useEvent`, remove that variable — it's no longer needed (the route only renders if an event exists).

6. Replace all occurrences of `SLUG` (used in Supabase query params like `event_id`) — these should already be using `event?.id` or `event?.slug` by the time they appear after the hook call. Double-check by searching for remaining `SLUG` references in the file after step 4.

**Step 1: Verify no `SLUG` or `useEvent(` remains in the three files**

```bash
grep -n "SLUG\|useEvent(" src/pages/Dashboard.tsx src/pages/AutomationTimeline.tsx src/pages/DashboardSettings.tsx
```

Expected: no output.

**Step 2: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/AutomationTimeline.tsx src/pages/DashboardSettings.tsx
git commit -m "feat(auth): replace hardcoded SLUG with useEventContext in all dashboard pages"
```

---

### Task 12: Update DashboardNav for Draft Mode

**Files:**
- Modify: `src/components/dashboard/DashboardNav.tsx`

**Step 1: Replace the entire file content**

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

const ALL_TABS = [
  { path: '/dashboard',          label: 'אורחים',  requiresActive: true  },
  { path: '/dashboard/timeline', label: 'ציר זמן', requiresActive: true  },
  { path: '/dashboard/settings', label: 'הגדרות',  requiresActive: false },
] as const;

export default function DashboardNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { canManageGuests } = useFeatureAccess();

  const tabs = ALL_TABS.filter(tab => !tab.requiresActive || canManageGuests);

  return (
    <nav dir="rtl" className="flex gap-1 bg-white/60 backdrop-blur-sm rounded-xl p-1 mb-6 w-fit font-brand">
      {tabs.map(tab => {
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={[
              'px-5 py-2 rounded-lg text-sm font-medium transition-all',
              active
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-violet-600 hover:bg-white/80',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
```

**Step 2: Add redirect guard to `Dashboard.tsx` and `AutomationTimeline.tsx`**

In both files, add at the top of the component function (after the hooks):
```tsx
import { Navigate } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

// inside component, after existing hooks:
const { canManageGuests } = useFeatureAccess();
if (!canManageGuests) return <Navigate to="/dashboard/settings" replace />;
```

**Step 3: Commit**

```bash
git add src/components/dashboard/DashboardNav.tsx src/pages/Dashboard.tsx src/pages/AutomationTimeline.tsx
git commit -m "feat(auth): hide locked tabs + redirect draft users to settings"
```

---

### Task 13: Draft State Banner in DashboardSettings

**Files:**
- Modify: `src/pages/DashboardSettings.tsx`

**Step 1: Add import and banner**

Add to existing imports:
```tsx
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
```

Add inside the component function (alongside existing hooks):
```tsx
const { canManageGuests } = useFeatureAccess();
```

In the JSX, immediately after `<DashboardNav />` and before the form/content, add:
```tsx
{!canManageGuests && (
  <div
    dir="rtl"
    className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-brand"
  >
    <span className="font-semibold">האירוע שלכם במצב טיוטה</span>
    {' — '}Preview ועריכת עיצוב פעילים. גישה לניהול אורחים ו-WhatsApp תיפתח לאחר אישור.
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/pages/DashboardSettings.tsx
git commit -m "feat(auth): add draft mode banner in DashboardSettings"
```

---

## Post-Implementation Manual Steps (After Deployment)

1. **Enable Google OAuth in Supabase** (if not done in pre-requisites)

2. **Bootstrap your own account:**
   - Open the app → click "המשיכו עם Google" → sign in with your Google account
   - Your `users` row is created automatically by the trigger
   - In Supabase dashboard → Table editor → `user_events` → Insert row:
     ```
     user_id:  <your id from auth.users>
     event_id: <hagit-and-itai id from events>
     role:     owner
     ```
   - Reload → you should land on `/dashboard` with full access

3. **Test new couple flow (incognito):**
   - Go to `/login` → sign in with a different Google account
   - Should redirect to `/onboarding`
   - Complete the wizard → lands on `/dashboard/settings`
   - Draft banner visible, "אורחים" and "ציר זמן" tabs hidden

4. **Test admin approval:**
   - Supabase dashboard → `events` → find the new event → set `status = 'active'`
   - Couple refreshes page → banner disappears, all tabs visible

5. **Verify RSVP pages unaffected:**
   - Open `/<slug>` in incognito (no login) → RSVP form works normally
   - The `arrival_permits` anon RLS policies were not touched
