# Phase 5: Paywalls & Upgrade Modal - Research

**Researched:** 2026-03-16
**Domain:** Feature gating UI, modal components, paywall intercepts (React + Radix + Tailwind)
**Confidence:** HIGH

## Summary

Phase 5 is a purely frontend phase. All backend gating logic already exists via the `useFeatureAccess` hook (Phase 3, complete). This phase adds the UI intercepts: an `UpgradeModal` component and paywall guards at 6 specific interaction points in the Dashboard and AutomationTimeline pages.

The codebase already has two proven modal patterns: (1) Radix Dialog-based `Sheet` for side drawers, and (2) a custom centered glassmorphism overlay used by `StageEditModal`. The UpgradeModal should follow the StageEditModal's centered glass pattern (GlassCard + fixed backdrop) since it is a promotional/informational modal, not a form drawer.

**Primary recommendation:** Build a single reusable `UpgradeModal` component with open/close state, then add 6 conditional intercepts at the existing button onClick handlers in Dashboard.tsx and one route-level guard in AutomationTimeline.tsx. No new dependencies needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-01 | Timeline tab renders premium placeholder when `!canAccessTimeline` | Replace current `<Navigate>` redirect in AutomationTimeline.tsx with a full-page premium placeholder component |
| PAY-02 | Import button opens UpgradeModal when `!canImportGuests` | Intercept `setIsUploadOpen(true)` at line 1292 with conditional check |
| PAY-03 | Export button opens UpgradeModal when `!canExportGuests` | Intercept `handleExportAll` at line 1299 with conditional check |
| PAY-04 | Add Guest beyond 20 limit opens UpgradeModal | Intercept `openModal` at line 1285 with `invitations.length >= maxFreeGuests && !isActive` check |
| PAY-05 | Send Message bulk action opens UpgradeModal when `!canSendMessages` | Intercept `setIsMessageModalOpen(true)` at line 1670 with conditional check |
| PAY-06 | Bulk Export action opens UpgradeModal when `!canExportGuests` | Intercept `handleExportSelected` at line 1678 with conditional check |
| UPG-01 | Reusable UpgradeModal at `src/components/ui/UpgradeModal.tsx` | Use existing GlassCard + fixed backdrop pattern from StageEditModal |
| UPG-02 | Modal uses existing design system (GlassCard/Radix Dialog) | GlassCard primitives already exist at `src/components/ui/glass-card.tsx` |
| UPG-03 | Modal explains premium benefits in Hebrew | Static content: unlimited guests, Excel import, WhatsApp automation |
| UPG-04 | Upgrade button shows "Coming Soon" toast | Reuse existing toast pattern from Dashboard.tsx (fixed bottom-right div with setTimeout) |
| UPG-05 | Modal is Hebrew RTL with font-brand / font-danidin | Standard project typography utilities, dir="rtl" |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ | Component framework | Already used throughout |
| @radix-ui/react-dialog | ^1.1.15 | Dialog primitives (Sheet uses this) | Already installed |
| Tailwind CSS | (project config) | Styling | Project standard |
| lucide-react | (installed) | Icons | Project standard |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GlassCard family | local | Glassmorphism card primitives | UpgradeModal outer shell |
| cn (clsx/twMerge) | local | Conditional class merging | All component styling |

### No New Dependencies Needed
This phase requires zero new npm packages. Everything is already available in the project.

## Architecture Patterns

### Recommended File Structure
```
src/
  components/
    ui/
      UpgradeModal.tsx          # NEW — reusable upgrade modal
  pages/
    Dashboard.tsx               # MODIFY — add intercepts at 5 buttons
    AutomationTimeline.tsx      # MODIFY — replace Navigate redirect with premium placeholder
```

### Pattern 1: Centered Glass Modal (from StageEditModal)
**What:** A fixed backdrop + centered GlassCard, no Radix Dialog needed.
**When to use:** Informational/promotional modals that don't need complex focus trapping.
**Example:**
```typescript
// Source: src/components/dashboard/StageEditModal.tsx lines 222-236
<>
  {/* Backdrop */}
  <div
    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 transition-opacity"
    onClick={onClose}
  />
  {/* Modal */}
  <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
    <div className="pointer-events-auto w-full max-w-lg mx-4">
      <GlassCard className="rounded-3xl shadow-2xl">
        {/* content */}
      </GlassCard>
    </div>
  </div>
</>
```

### Pattern 2: Conditional Intercept at Button Handler
**What:** Check feature access before executing the original action; open UpgradeModal instead if gated.
**When to use:** Every PAY-0x requirement.
**Example:**
```typescript
// Before:
onClick={() => setIsUploadOpen(true)}

// After:
onClick={() => canImportGuests ? setIsUploadOpen(true) : setUpgradeOpen(true)}
```

### Pattern 3: Full-Page Premium Placeholder (PAY-01)
**What:** Instead of redirecting draft users away from Timeline, show a full-page placeholder with upgrade messaging.
**When to use:** PAY-01 — replaces the current `<Navigate to="/dashboard/settings" replace />` in AutomationTimeline.tsx.
**Rationale:** The current behavior (redirect to settings) is invisible and confusing. A visible placeholder communicates value and drives upgrade intent.
**Example:**
```typescript
// AutomationTimeline.tsx — replace line 963
if (!canAccessTimeline) return <TimelinePremiumPlaceholder />;
```
The placeholder should render DashboardNav (so user keeps nav context) + a centered card explaining the Timeline is a premium feature.

### Pattern 4: Guest Limit Gating (PAY-04)
**What:** The Add Guest button checks `invitations.length >= maxFreeGuests` combined with event status.
**When to use:** PAY-04 specifically.
**Important nuance:** The `useFeatureAccess` hook returns `maxFreeGuests: 20` as a number, but it does NOT return a `canAddGuest` boolean because the check depends on the current guest count which is local state in Dashboard.tsx. The gating logic must be computed inline:
```typescript
const isAtGuestLimit = !isActive && invitations.length >= maxFreeGuests;
// Then in onClick:
onClick={() => isAtGuestLimit ? setUpgradeOpen(true) : openModal()}
```
Note: `isActive` (from useEventContext) is already equivalent to `!isSuperAdmin && status !== 'active'` since `useFeatureAccess` uses `unlocked = isSuperAdmin || isActive`. For the guest limit, we need the event-status-only check: draft users hit the limit, active users and super admins do not.

### Pattern 5: DashboardNav Timeline Tab Visibility
**What:** Currently DashboardNav HIDES the Timeline tab when `!canAccessTimeline` (line 16 filter). For PAY-01 to work, the tab must remain VISIBLE so users can click it and see the placeholder.
**Critical change:** Remove the `gateKey` filter for the Timeline tab in DashboardNav so it always shows, then let AutomationTimeline.tsx handle showing the placeholder internally.

### Anti-Patterns to Avoid
- **Separate modal per intercept point:** Do NOT create multiple modal components. One `UpgradeModal` with `isOpen`/`onClose` props is sufficient.
- **Radix Dialog for UpgradeModal:** The project already uses a non-Radix centered modal pattern (StageEditModal). Using Radix Dialog would introduce an inconsistent pattern for a simple informational modal. Keep it consistent.
- **Disabling buttons instead of intercepting:** Requirements say the modal should OPEN, not that buttons should appear disabled. Users should feel they can click; the modal explains why they need to upgrade.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal overlay | Custom portal/focus trap | Copy StageEditModal backdrop pattern | Already works, consistent UX |
| Toast notification | New toast library | Existing inline toast in Dashboard.tsx | Pattern already proven, no new deps |
| Feature gating logic | New permission system | Existing `useFeatureAccess` hook | Phase 3 already built this |
| Event status check | Direct Supabase queries | `useEventContext().isActive` | Already resolved in context |

## Common Pitfalls

### Pitfall 1: DashboardNav Hiding the Timeline Tab
**What goes wrong:** If DashboardNav continues to filter out the Timeline tab for draft users, they can never navigate to `/dashboard/timeline` and PAY-01's placeholder will never be seen.
**Why it happens:** Phase 3 implemented gating by hiding the tab entirely.
**How to avoid:** Make the Timeline tab always visible in DashboardNav. The gating happens inside AutomationTimeline.tsx.
**Warning signs:** Testing PAY-01 by direct URL works but clicking tab doesn't (because tab is hidden).

### Pitfall 2: Guest Limit Off-by-One
**What goes wrong:** Using `>` instead of `>=` for the guest limit check, allowing 21 guests.
**Why it happens:** `maxFreeGuests` is 20, meaning the 20th guest IS allowed but the 21st is not.
**How to avoid:** Use `invitations.length >= maxFreeGuests` — when there are already 20 guests, the next add attempt triggers the modal.
**Warning signs:** Draft users can add 21 guests before seeing the modal.

### Pitfall 3: Super Admin Bypass
**What goes wrong:** Super admins seeing upgrade modals.
**Why it happens:** Forgetting that `useFeatureAccess` already accounts for `isSuperAdmin` in the `unlocked` flag.
**How to avoid:** All checks flow through `useFeatureAccess` which already handles super admin. For PAY-04 (guest limit), also check `isActive` from context (which is already true for super admins viewing active events).
**Warning signs:** Super admin accounts hitting paywalls.

### Pitfall 4: Toast Z-Index Conflict
**What goes wrong:** The "Coming Soon" toast appears behind the UpgradeModal backdrop.
**Why it happens:** The modal backdrop is z-50; the existing toast is also z-50.
**How to avoid:** Render the toast at z-60 (same pattern as Timeline toasts) or dismiss the modal before showing the toast.
**Warning signs:** Toast invisible or flickering.

### Pitfall 5: Bulk Action Bar Intercepts Missing
**What goes wrong:** The bulk action bar's "Send Message" and "Export" buttons are separate from the header buttons but need the same gating.
**Why it happens:** Two separate button groups exist: header (lines 1283-1304) and floating bulk bar (lines 1667-1683).
**How to avoid:** Gate both sets: PAY-02/PAY-03 cover header buttons; PAY-05/PAY-06 cover bulk action buttons.
**Warning signs:** Draft users bypassing paywall via bulk selection actions.

## Code Examples

### UpgradeModal Component Structure
```typescript
// Source: Pattern derived from StageEditModal.tsx + project design system
interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md mx-4" dir="rtl">
          <GlassCard className="rounded-3xl shadow-2xl">
            {/* Header with icon + title (font-danidin) */}
            {/* Benefits list (font-brand) */}
            {/* CTA button -> shows Coming Soon toast */}
            {/* Close button */}
          </GlassCard>
        </div>
      </div>
    </>
  );
}
```

### Intercept Pattern in Dashboard.tsx
```typescript
// Add state for upgrade modal
const [upgradeOpen, setUpgradeOpen] = useState(false);
const { canImportGuests, canExportGuests, canSendMessages, maxFreeGuests } = useFeatureAccess();
const { isActive } = useEventContext();
const isAtGuestLimit = !isActive && invitations.length >= maxFreeGuests;

// Import button intercept (PAY-02)
onClick={() => canImportGuests ? setIsUploadOpen(true) : setUpgradeOpen(true)}

// Export button intercept (PAY-03)
onClick={() => canExportGuests ? handleExportAll() : setUpgradeOpen(true)}

// Add guest intercept (PAY-04)
onClick={() => isAtGuestLimit ? setUpgradeOpen(true) : openModal()}

// Bulk send intercept (PAY-05)
onClick={() => canSendMessages ? setIsMessageModalOpen(true) : setUpgradeOpen(true)}

// Bulk export intercept (PAY-06)
onClick={() => canExportGuests ? handleExportSelected() : setUpgradeOpen(true)}
```

### Timeline Premium Placeholder (PAY-01)
```typescript
// Inside AutomationTimeline.tsx, replace the Navigate redirect
if (!canAccessTimeline) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-brand" dir="rtl">
      <header>{/* Same header structure as the real timeline */}</header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav />
        {/* Centered premium placeholder card */}
        <div className="flex items-center justify-center py-20">
          <GlassCard className="max-w-md w-full rounded-3xl text-center p-8">
            {/* Icon, heading, description, CTA */}
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
```

### Toast Pattern (from Dashboard.tsx)
```typescript
// Existing pattern at lines 1254-1259
const [toast, setToast] = useState<string | null>(null);
const showToast = (msg: string) => {
  setToast(msg);
  setTimeout(() => setToast(null), 3000);
};

// In UpgradeModal CTA:
<button onClick={() => { onClose(); showToast('Coming Soon'); }}>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redirect draft users away from Timeline | Show premium placeholder in-place | Phase 5 (now) | Better UX, communicates value |
| Hide gated tabs entirely | Show tabs + intercept with upgrade prompts | Phase 5 (now) | Drives upgrade intent |

## Open Questions

1. **Toast callback from UpgradeModal**
   - What we know: Dashboard.tsx has its own toast state; UpgradeModal needs to trigger a toast on CTA click
   - What's unclear: Should UpgradeModal own its own toast, or receive an `onUpgradeClick` callback?
   - Recommendation: Pass an `onUpgradeClick` callback from the parent. The parent shows the toast using its existing toast mechanism. This keeps UpgradeModal stateless regarding toasts.

2. **Escape key handling for UpgradeModal**
   - What we know: StageEditModal handles Escape via a manual `keydown` listener
   - Recommendation: Same pattern. Add useEffect with keydown listener when isOpen is true.

## Sources

### Primary (HIGH confidence)
- `src/hooks/useFeatureAccess.ts` — Feature gating hook, all 6 gate flags verified
- `src/components/ui/glass-card.tsx` — GlassCard family, full API verified
- `src/components/dashboard/StageEditModal.tsx` — Centered modal pattern (backdrop + GlassCard)
- `src/pages/Dashboard.tsx` — All 5 button intercept points located with line numbers
- `src/pages/AutomationTimeline.tsx` — Current redirect at line 963 identified
- `src/components/dashboard/DashboardNav.tsx` — Tab filtering logic at line 16 identified
- `src/contexts/EventContext.tsx` — `isActive` derived from `currentEvent?.status === 'active'`

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — All 11 requirement IDs verified with descriptions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new deps needed
- Architecture: HIGH - All patterns verified against existing codebase with line numbers
- Pitfalls: HIGH - Derived from actual code analysis of current behavior

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable - no external dependencies or fast-moving APIs)
