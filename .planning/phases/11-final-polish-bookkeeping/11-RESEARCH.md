# Phase 11: Final Polish & Bookkeeping - Research

**Researched:** 2026-03-18
**Domain:** TypeScript type safety, React context async coordination, documentation consistency
**Confidence:** HIGH

## Summary

Phase 11 closes four remaining tech debt items for a pristine v1.0 release. All four requirements are well-scoped, low-risk, and involve modifications to existing files with clear before/after states. No new libraries or architectural changes are needed.

The most nuanced item is POLISH-02 (super admin double-fetch), which requires understanding the async interplay between `AuthContext` and `EventContext`. The root cause is that `setSession(s)` in `AuthContext` triggers a re-render where `user` becomes non-null before `isSuperAdmin` is resolved, causing `EventContext` to fire its fetch effect twice. The fix is straightforward: gate `EventContext`'s fetch on `AuthContext.loading === false`.

**Primary recommendation:** Address all four items in a single plan with one task per requirement. No external dependencies, no migrations, no new packages.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POLISH-01 | `DashboardSettings.tsx` has zero `(currentEvent as any)` casts -- uses typed `EventData` properties | 4 cast sites identified at lines 285, 329, 653, 672. `EventData` interface already has `id` and `content_config`. `LivePreview` prop type needs alignment. |
| POLISH-02 | `EventContext` defers initial fetch until `isSuperAdmin` has resolved -- no double-fetch for super admins | Root cause traced: `setSession` in AuthContext triggers render before `setIsSuperAdmin`. Fix: add `loading` from `useAuth()` as gate in EventContext effect. |
| POLISH-03 | All ROADMAP.md plan checkboxes and phase statuses match actual completion state | Phase 7 task checkboxes show `[ ]` despite completion. All phases 1-10 are complete per STATE.md. Full audit needed. |
| POLISH-04 | `.env.example` documents `SUPABASE_SERVICE_ROLE_KEY` with E2E teardown explanation | File already exists with this variable documented. Verify description clarity meets requirement. |
</phase_requirements>

## Standard Stack

No new libraries needed. This phase modifies existing TypeScript files and markdown documentation only.

### Core (already in project)
| Library | Purpose | Relevant to |
|---------|---------|-------------|
| TypeScript | Type safety for `EventData` interface usage | POLISH-01 |
| React Context | `AuthContext` + `EventContext` async coordination | POLISH-02 |

## Architecture Patterns

### Pattern 1: Removing `as any` Casts via Interface Alignment

**What:** `DashboardSettings.tsx` casts `currentEvent as any` in 4 places because it needs `content_config` and `id` properties. The `EventData` interface already declares both.

**Root cause:** `currentEvent` is typed as `EventData | null`. The component already null-guards with `if (!currentEvent) return;` but the cast happens after the guard in the effect and handler. The `as any` was likely a quick fix during initial development.

**The 4 cast sites:**
1. **Line 285:** `(currentEvent as any).content_config` -- `EventData` already has `content_config: Record<string, unknown> | null`
2. **Line 329:** `(currentEvent as any).id` -- `EventData` already has `id: string`
3. **Line 653:** `event={currentEvent as any}` -- passed to `LivePreview` which expects `{ id, slug, template_id, event_date }`
4. **Line 672:** `event={currentEvent as any}` -- same as above

**Fix strategy:**
- Lines 285 and 329: Simply remove `as any` -- the types already match
- Lines 653 and 672: `LivePreview` prop type expects `{ id: string; slug: string; template_id: string; event_date: string }` but `EventData.event_date` is `string | null`. Either update `LivePreview` prop to accept `string | null` or pass a narrowed type. Updating `LivePreview` is cleaner since it should handle null dates gracefully.

### Pattern 2: Context Dependency Gating (Double-Fetch Fix)

**What:** `EventContext` must not fetch until `AuthContext` has fully resolved (including `isSuperAdmin`).

**Current flow (problematic for super admins):**
```
AuthContext.getSession() resolves
  -> setSession(s)            // triggers render: user is now non-null
  -> [async] query is_super_admin
  -> setIsSuperAdmin(true)    // triggers second render
  -> setLoading(false)

EventContext effect depends on [user?.id, isSuperAdmin, tick]
  -> Fires on user change (isSuperAdmin still false) -> fetchEventsForUser()
  -> Fires again on isSuperAdmin change -> fetchAllEvents()
  = TWO fetches instead of ONE
```

**Fix:** Add `loading` from `useAuth()` as a guard in `EventContext`:
```typescript
const { user, isSuperAdmin, loading: authLoading } = useAuth();

useEffect(() => {
  // Wait for auth to fully resolve (including isSuperAdmin)
  if (authLoading) return;
  if (!user?.id) { /* clear state */ return; }
  // ... existing fetch logic
}, [user?.id, isSuperAdmin, authLoading, tick]);
```

This ensures the effect only fires once `authLoading` is false, at which point both `user` and `isSuperAdmin` are finalized. The effect still re-runs on `tick` for manual refetch.

**Why this works:** `AuthContext` sets `loading = false` only AFTER resolving `isSuperAdmin` (line 39 of AuthContext.tsx). So gating on `!authLoading` guarantees both values are settled.

### Anti-Patterns to Avoid
- **Adding `useRef` to track "first fetch":** Over-engineering. The `authLoading` gate is simpler and correct.
- **Debouncing the fetch:** Hides the bug instead of fixing the root cause.
- **Moving isSuperAdmin resolution into EventContext:** Violates separation of concerns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type narrowing after null check | Custom type guard functions | TypeScript's built-in control flow narrowing | `if (!currentEvent) return;` already narrows the type in the remaining scope |

## Common Pitfalls

### Pitfall 1: LivePreview Prop Type Mismatch
**What goes wrong:** Removing `as any` from `LivePreview` call sites causes TS error because `EventData.event_date` is `string | null` but `LivePreview` expects `string`.
**How to avoid:** Update `LivePreview`'s `event` prop to accept `EventData` directly (or at minimum accept `event_date: string | null`). The iframe URL is built from `event.slug`, not `event_date`, so null date is harmless.

### Pitfall 2: content_config Type Narrowing
**What goes wrong:** `EventData.content_config` is `Record<string, unknown> | null`. The local `ContentConfig` interface in DashboardSettings is more specific. Direct assignment without cast may cause type error.
**How to avoid:** Use `(currentEvent.content_config ?? {}) as ContentConfig` -- this is a legitimate type assertion at the data boundary (JSONB from DB), not a lazy `as any`.

### Pitfall 3: ROADMAP Checkbox Consistency
**What goes wrong:** Phase 7 has individual task checkboxes showing `[ ]` (unchecked) despite Phase 7 being complete. Phase 6 similarly has task checkboxes. These are inline task lists, not plan references.
**How to avoid:** Audit every checkbox in ROADMAP.md against actual completion. Plans (plan references) and tasks (inline items) need separate verification.

### Pitfall 4: .env.example May Already Be Correct
**What goes wrong:** Wasting time "fixing" something that is already done.
**Current state:** `.env.example` already contains `SUPABASE_SERVICE_ROLE_KEY` with a comment: "Used only by Playwright E2E test teardown (afterAll cleanup)". This appears to already satisfy POLISH-04. Verify the description is sufficient and matches the requirement exactly.

## Code Examples

### POLISH-01: Removing `as any` from DashboardSettings.tsx

**Line 285 fix (content_config access):**
```typescript
// Before:
const config = (currentEvent as any).content_config ?? {};

// After:
const config = (currentEvent.content_config ?? {}) as ContentConfig;
```

**Line 329 fix (id access):**
```typescript
// Before:
await updateEventContentConfig((currentEvent as any).id, toSave);

// After:
await updateEventContentConfig(currentEvent.id, toSave);
```

**Lines 653/672 fix (LivePreview prop):**

Update `LivePreview` interface:
```typescript
// Before (LivePreview.tsx):
interface LivePreviewProps {
  event: { id: string; slug: string; template_id: string; event_date: string };
  // ...
}

// After:
interface LivePreviewProps {
  event: { id: string; slug: string; template_id: string; event_date: string | null };
  // ...
}
```

Then in DashboardSettings.tsx:
```typescript
// Before:
<LivePreview event={currentEvent as any} config={draft} width={320} />

// After:
<LivePreview event={currentEvent} config={draft} width={320} />
```

### POLISH-02: EventContext Double-Fetch Fix

```typescript
// In EventContext.tsx:
export function EventProvider({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  // ... existing state ...

  useEffect(() => {
    if (authLoading) return;          // <-- NEW: wait for auth resolution
    if (!user?.id) {
      setEvents([]);
      setCurrentEvent(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchFn = isSuperAdmin ? fetchAllEvents : fetchEventsForUser;
    // ... rest unchanged ...
  }, [user?.id, isSuperAdmin, authLoading, tick]);  // <-- ADD authLoading
  // ...
}
```

## State of the Art

No technology changes relevant to this phase. All fixes use existing TypeScript and React patterns.

## Open Questions

1. **POLISH-04: Is .env.example already sufficient?**
   - What we know: The file already documents `SUPABASE_SERVICE_ROLE_KEY` with "Used only by Playwright E2E test teardown (afterAll cleanup)" comment and a hint to find it in Supabase Dashboard.
   - What's unclear: Whether the current description fully satisfies the requirement or needs more detail.
   - Recommendation: Compare current text against requirement wording. If it already explains the key's role in E2E teardown, mark as already complete and verify only.

2. **POLISH-03: Scope of ROADMAP audit**
   - What we know: Phase 7 task checkboxes are `[ ]` despite completion. Phase 6 plan reference shows `06-01-PLAN.md` which was retroactively created.
   - What's unclear: Whether any other inconsistencies exist across 11 phases.
   - Recommendation: Systematic line-by-line audit of ROADMAP.md against filesystem artifacts and STATE.md.

## Sources

### Primary (HIGH confidence)
- Direct source file inspection: `DashboardSettings.tsx`, `EventContext.tsx`, `AuthContext.tsx`, `LivePreview.tsx`
- Project REQUIREMENTS.md -- requirement definitions
- Project ROADMAP.md -- current checkbox states
- `.env.example` -- current documentation state

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, pure code fixes
- Architecture (POLISH-01): HIGH - direct file inspection, types verified
- Architecture (POLISH-02): HIGH - async flow traced through AuthContext and EventContext source
- Pitfalls: HIGH - all edge cases identified from actual source code
- ROADMAP audit (POLISH-03): MEDIUM - known issues identified but full audit needed during execution

**Research date:** 2026-03-18
**Valid until:** Indefinite (project-specific tech debt, not dependent on external ecosystem)
