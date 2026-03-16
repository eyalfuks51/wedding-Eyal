# Phase 2: Onboarding Refinement - Research

**Researched:** 2026-03-16
**Domain:** React multi-step wizard, Supabase event creation, slug generation, post-creation UX
**Confidence:** HIGH

## Summary

Phase 2 refines the existing `OnboardingPage.tsx` wizard to satisfy five requirements: standalone rendering (no DashboardNav), event creation with `status='draft'` and auto-slug, linking via `user_events`, a success screen with the live public link, and redirect to `/dashboard/settings`. The existing codebase already has ~80% of this implemented -- the wizard exists, `createOnboardingEvent` in `supabase.js` already creates draft events and links via `user_events`, and the page already renders without DashboardNav.

The main gaps are: (1) the wizard skips the success screen and navigates directly to `/dashboard/settings` on line 39, (2) the slug generation uses `Date.now()` which is functional but not user-friendly, (3) the `partner1_name`/`partner2_name` columns on `events` are not populated during creation, and (4) there is no auth guard on the `/onboarding` route (unauthenticated users can access it).

**Primary recommendation:** This is a refinement phase -- modify the existing OnboardingPage to add a Step 4 success screen showing the live link, populate `partner1_name`/`partner2_name` during event creation, add an auth guard to the onboarding route, and call `EventContext.refetch()` after creation so the new event appears immediately.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ONB-01 | Onboarding page is standalone -- does NOT render DashboardNav | Already satisfied -- OnboardingPage.tsx renders its own standalone UI with no DashboardNav import |
| ONB-02 | Wizard creates event with `status = 'draft'` and auto-generates slug | Mostly done -- `createOnboardingEvent` sets `status: 'draft'`, slug generation exists but needs cleanup. Must also populate `partner1_name`/`partner2_name` and `event_date` on the events row |
| ONB-03 | Wizard links new event to user via `user_events` table | Already done -- `createOnboardingEvent` inserts into `user_events` with `role: 'owner'` |
| ONB-04 | On completion, user sees success UI with their live public link (`/:slug`) | Missing -- currently skips to navigate('/dashboard/settings'). Need a Step 4 success screen |
| ONB-05 | After success, user is redirected to `/dashboard/settings` | Partially done -- redirect exists but fires immediately. Need it to fire after user sees success screen (e.g., button click or timed redirect) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Already in use |
| React Router | 6+ | Navigation, `useNavigate` | Already in use for all routing |
| Supabase JS | 2.x | Backend client | Already in use, `createOnboardingEvent` exists |
| Tailwind CSS | 3.x | Styling | Already in use throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | latest | Icons | Copy/link icon on success screen |

### Alternatives Considered
None -- this phase uses only existing dependencies.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Existing File Structure (modify in place)
```
src/
  pages/
    OnboardingPage.tsx       # Modify: add Step 4 success, auth guard, slug cleanup
  lib/
    supabase.js              # Modify: update createOnboardingEvent to include partner names + event_date
  App.jsx                    # Modify: wrap /onboarding with auth guard
  contexts/
    EventContext.tsx          # No changes -- refetch() already exists
  components/
    auth/ProtectedRoute.tsx  # No changes -- already redirects no-event users to /onboarding
```

### Pattern 1: Multi-Step Wizard with Success Screen
**What:** Extend existing 3-step wizard (template choice -> event details -> confirmation) with a 4th step (success + live link)
**When to use:** After `createOnboardingEvent` resolves successfully
**Example:**
```typescript
// Current flow: step 1 -> 2 -> 3 -> handleFinish() -> navigate('/dashboard/settings')
// New flow:     step 1 -> 2 -> 3 -> handleFinish() -> step 4 (success) -> button -> navigate

const [createdSlug, setCreatedSlug] = useState<string | null>(null);

const handleFinish = async () => {
  // ... existing creation logic ...
  const slug = generateSlug(form.partner1, form.partner2);
  const event = await createOnboardingEvent({ slug, templateId, contentConfig, partner1Name, partner2Name, eventDate });
  setCreatedSlug(slug);
  setStep(4); // Show success screen instead of navigating
};

// Step 4: Success screen
{step === 4 && createdSlug && (
  <>
    <h2 className="font-danidin text-2xl text-slate-800 mb-1">האירוע נוצר בהצלחה!</h2>
    <p className="text-slate-500 text-sm mb-6">הנה הקישור לעמוד האירוע שלכם</p>
    <div className="bg-violet-50 rounded-xl p-4 text-center">
      <a href={`/${createdSlug}`} target="_blank" className="text-violet-600 font-medium">
        {window.location.origin}/{createdSlug}
      </a>
      {/* Copy button */}
    </div>
    <button onClick={() => navigate('/dashboard/settings', { replace: true })}>
      המשיכו להגדרות
    </button>
  </>
)}
```

### Pattern 2: Slug Generation
**What:** Generate URL-safe slug from partner names
**Current approach:** `${form.partner1}-and-${form.partner2}` lowercased + timestamp suffix
**Issue:** Hebrew names produce empty slugs after the `[^a-z0-9-]` regex strips non-Latin chars. Timestamp suffix makes URLs ugly.
**Recommended approach:**
```typescript
function generateSlug(p1: string, p2: string): string {
  // Transliterate or use Latin-safe fallback
  const base = `${p1}-and-${p2}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0590-\u05ff-]/g, '') // Keep Hebrew chars
    .slice(0, 40);
  // Add short random suffix for uniqueness (6 chars)
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `event-${suffix}`;
}
```
**Alternative:** Keep it simple -- if names are Hebrew, use a transliterated pattern or just `event-XXXXXX`. The slug just needs to be unique and URL-safe. Hebrew in URLs works but looks ugly when encoded.

### Pattern 3: Auth Guard on Onboarding
**What:** Prevent unauthenticated users from accessing `/onboarding`
**Current state:** `/onboarding` route in `App.jsx` has NO auth wrapper -- anyone can visit it
**Fix:** Either wrap with a lightweight auth check or create a simple `RequireAuth` wrapper (lighter than `ProtectedRoute` which also provides `EventProvider`)
```typescript
// Simple auth-only guard (no EventProvider needed for onboarding)
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

### Pattern 4: Post-Creation Context Refresh
**What:** After creating the event, ensure EventContext picks up the new event
**Problem:** User creates event on onboarding, then navigates to `/dashboard/settings` which is wrapped in `ProtectedRoute` -> `EventProvider`. The EventProvider will fetch fresh on mount, so this should work automatically.
**However:** If the user is fast or caching is involved, calling `refetch()` explicitly is safer. But since onboarding is OUTSIDE EventProvider (no ProtectedRoute wrapper), we cannot call `refetch()` from OnboardingPage. The navigation to `/dashboard/settings` will mount a new EventProvider which fetches fresh -- this is fine.

### Anti-Patterns to Avoid
- **Don't add DashboardNav to onboarding:** ONB-01 explicitly requires standalone. The current page is already standalone.
- **Don't use EventContext in onboarding:** The page exists outside EventProvider. Use `createOnboardingEvent` directly via supabase.js.
- **Don't redirect immediately after creation:** The success screen (ONB-04) must be visible before the redirect to settings (ONB-05).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Copy to clipboard | Custom clipboard API wrapper | `navigator.clipboard.writeText()` | Browser API, works in all modern browsers |
| Auth guard | Complex permission system | Simple `useAuth()` check in wrapper | Only need authenticated/not check |
| Unique slug | UUID-based complex system | Short random suffix on name-based slug | Supabase UNIQUE constraint on slug catches collisions |

## Common Pitfalls

### Pitfall 1: Hebrew Characters in Slugs
**What goes wrong:** The current regex `[^a-z0-9-]` strips ALL Hebrew characters, producing empty or "-and-" slugs when both names are Hebrew
**Why it happens:** Regex designed for Latin-only input
**How to avoid:** Either keep Hebrew chars in slug (they work in URLs), transliterate, or fall back to a generic pattern when names are non-Latin
**Warning signs:** Slug like "-and--1710590400000" in the database

### Pitfall 2: Race Condition on Event Creation
**What goes wrong:** `createOnboardingEvent` does two sequential writes (INSERT event, then INSERT user_events). If the second fails, orphan event exists with no owner.
**Why it happens:** No transaction wrapping the two inserts
**How to avoid:** For v1 this is acceptable risk (Supabase JS client doesn't support multi-statement transactions from the client). Could wrap in an RPC if this becomes a real issue. The current implementation is fine for now.
**Warning signs:** Events in DB with no corresponding user_events row

### Pitfall 3: Onboarding Accessible Without Auth
**What goes wrong:** Unauthenticated user visits `/onboarding`, fills out wizard, then `supabase.auth.getUser()` fails inside `createOnboardingEvent`
**Why it happens:** `/onboarding` route has no auth guard in App.jsx
**How to avoid:** Add a `RequireAuth` wrapper around the onboarding route
**Warning signs:** Error "Not authenticated" on form submission

### Pitfall 4: Missing partner1_name/partner2_name on Event Row
**What goes wrong:** `createOnboardingEvent` only sets `slug`, `template_id`, `content_config`, `status` but does NOT set `partner1_name` or `partner2_name` columns on the events table
**Why it happens:** These columns were added for Phase 4 event switcher but the onboarding function predates them
**How to avoid:** Add `partner1_name` and `partner2_name` to the INSERT in `createOnboardingEvent`
**Warning signs:** Event switcher in Phase 4 shows blank names

### Pitfall 5: Missing event_date on Event Row
**What goes wrong:** `createOnboardingEvent` does not set `event_date` column even though the wizard collects a date
**Why it happens:** The date is stored in `content_config.date_display` as a string but not in the `event_date` column
**How to avoid:** Pass `event_date` to the INSERT so sorting and timeline features work correctly
**Warning signs:** Events sort incorrectly in EventContext (sorts by `event_date` column)

## Code Examples

### Current createOnboardingEvent (supabase.js lines 322-341)
```typescript
export const createOnboardingEvent = async ({ slug, templateId, contentConfig }) => {
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

### Updated createOnboardingEvent (recommended)
```typescript
export const createOnboardingEvent = async ({
  slug, templateId, contentConfig, partner1Name, partner2Name, eventDate
}) => {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      slug,
      template_id: templateId,
      content_config: contentConfig,
      status: 'draft',
      partner1_name: partner1Name || null,
      partner2_name: partner2Name || null,
      event_date: eventDate || null,
    })
    .select('id, slug')
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

### Success Screen Copy-to-Clipboard
```typescript
const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  await navigator.clipboard.writeText(`${window.location.origin}/${createdSlug}`);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-event per user | Multi-event via EventContext | Phase 1 (just completed) | Onboarding must work with the new multi-event model |
| No auth on onboarding | Auth guard needed | This phase | Prevents unauthenticated access |
| Direct redirect after creation | Success screen first | This phase | Better UX, user sees their link |

## Open Questions

1. **Slug format for Hebrew names**
   - What we know: Current regex strips Hebrew, producing bad slugs
   - What's unclear: Whether to keep Hebrew in URLs, transliterate, or use generic slugs
   - Recommendation: Use Hebrew-safe regex (keep Hebrew chars). Modern browsers display Hebrew URLs fine. Add short random suffix for uniqueness.

2. **Preview route integration**
   - What we know: `EventPage` accepts `isPreview` prop, route exists at `/preview/:slug`
   - What's unclear: Should the success screen link to `/preview/:slug` or `/:slug`?
   - Recommendation: Link to `/:slug` (the actual public URL). Preview route is for dashboard use.

3. **Should onboarding set currentEventId in localStorage?**
   - What we know: EventContext reads from localStorage on mount. New event won't be selected unless stored.
   - What's unclear: Whether to set it in onboarding or let EventContext handle it
   - Recommendation: Set `localStorage.setItem('currentEventId', event.id)` after creation so when EventProvider mounts at `/dashboard/settings`, it picks up the new event immediately via `resolveCurrentEvent`.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/pages/OnboardingPage.tsx` -- current wizard implementation
- Codebase inspection: `src/lib/supabase.js` -- `createOnboardingEvent` function
- Codebase inspection: `src/App.jsx` -- route definitions
- Codebase inspection: `src/components/auth/ProtectedRoute.tsx` -- auth flow
- Codebase inspection: `src/contexts/EventContext.tsx` -- multi-event model

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- ONB-01 through ONB-05 requirement definitions
- `.planning/STATE.md` -- Phase 1 completion status

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing code
- Architecture: HIGH - modifying existing wizard, patterns clear from codebase
- Pitfalls: HIGH - identified from direct code inspection of current implementation

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable -- internal codebase, no external API changes)
