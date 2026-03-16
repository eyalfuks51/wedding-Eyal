# Requirements: Wedding RSVP Platform — Freemium PLG & Multi-Event

**Defined:** 2026-03-16
**Core Value:** Any couple can sign up, create a wedding event, and start collecting RSVPs immediately — free tier gently guides toward upgrade.

## v1 Requirements

### Database & Schema

- [ ] **DB-01**: `public.users` table has `is_super_admin` boolean column (default false)
- [ ] **DB-02**: Migration is non-breaking — all existing users get `is_super_admin = false`

### Multi-Event Context

- [ ] **CTX-01**: `EventContext` fetches array of events for the authenticated user
- [ ] **CTX-02**: Super admin users (`is_super_admin = true`) can fetch all events across the platform
- [ ] **CTX-03**: Regular users see only events linked via `user_events` join table
- [ ] **CTX-04**: `currentEvent` state managed in context with `switchEvent(id)` method
- [ ] **CTX-05**: `currentEventId` persisted in localStorage, falls back to first event on fresh login
- [ ] **CTX-06**: `supabase.js` has query functions for multi-event fetching (all events + user events)

### Onboarding

- [ ] **ONB-01**: Onboarding page is standalone — does NOT render `DashboardNav`
- [ ] **ONB-02**: Wizard creates event with `status = 'draft'` and auto-generates slug
- [ ] **ONB-03**: Wizard links new event to user via `user_events` table
- [ ] **ONB-04**: On completion, user sees success UI with their live public link (`/:slug`)
- [ ] **ONB-05**: After success, user is redirected to `/dashboard/settings`

### Feature Gating

- [ ] **GATE-01**: `useFeatureAccess` returns `canAccessSettings: true` (always open)
- [ ] **GATE-02**: `useFeatureAccess` returns `canAccessTimeline: true` only if event status === 'active'
- [ ] **GATE-03**: `useFeatureAccess` returns `canImportGuests: true` only if event status === 'active'
- [ ] **GATE-04**: `useFeatureAccess` returns `canExportGuests: true` only if event status === 'active'
- [ ] **GATE-05**: `useFeatureAccess` returns `canSendMessages: true` only if event status === 'active'
- [ ] **GATE-06**: `useFeatureAccess` returns `maxFreeGuests: 20`

### Dashboard Navigation

- [ ] **NAV-01**: Event Switcher dropdown in `DashboardNav` shows list of user's events
- [ ] **NAV-02**: Event Switcher only renders when `events.length > 1` or user is super admin
- [ ] **NAV-03**: Event Switcher includes "Create New Event" link pointing to `/onboarding`

### Paywall Intercepts

- [ ] **PAY-01**: Timeline tab renders "Premium Feature / Upgrade" placeholder when `!canAccessTimeline`
- [ ] **PAY-02**: Import button opens `UpgradeModal` instead of upload modal when `!canImportGuests`
- [ ] **PAY-03**: Export button opens `UpgradeModal` when `!canExportGuests`
- [ ] **PAY-04**: Add Guest button opens `UpgradeModal` when guest count >= `maxFreeGuests` and status is 'draft'
- [ ] **PAY-05**: "שלח הודעה" (Send Message) bulk action opens `UpgradeModal` when `!canSendMessages`
- [ ] **PAY-06**: Bulk Export action opens `UpgradeModal` when `!canExportGuests`

### Upgrade Modal

- [ ] **UPG-01**: Reusable `UpgradeModal` component at `src/components/ui/UpgradeModal.tsx`
- [ ] **UPG-02**: Modal uses existing design system (GlassCard/Radix Dialog patterns)
- [ ] **UPG-03**: Modal explains premium benefits (unlimited guests, Excel import, WhatsApp automation)
- [ ] **UPG-04**: "Upgrade" button shows "Coming Soon — Integration with Payment Gateway" toast
- [ ] **UPG-05**: Modal is Hebrew RTL with `font-brand` / `font-danidin` typography

### Protected Routes

- [ ] **AUTH-01**: `ProtectedRoute` handles multi-event: user with events → dashboard, user with no events → onboarding
- [ ] **AUTH-02**: `ProtectedRoute` provides `EventProvider` context to all dashboard pages

## v2 Requirements

### Payment Integration

- **PAY-V2-01**: Payment gateway integration to activate events (draft → active)
- **PAY-V2-02**: Pricing page with tier comparison
- **PAY-V2-03**: Billing management (receipts, cancellation)

### Admin Panel

- **ADM-01**: Super admin dashboard to view all events across platform
- **ADM-02**: Super admin can manually activate/deactivate events
- **ADM-03**: UI for managing super admin status

## Out of Scope

| Feature | Reason |
|---------|--------|
| Payment gateway | Phase 3 — UpgradeModal shows "Coming Soon" |
| Persistent draft banner | Decided against — modals-only approach |
| Super admin UI management | Manual DB flag sufficient for now |
| Per-feature pricing tiers | Single draft/active binary for v1 |
| Event deletion/archival | Not in this milestone |
| Free tier analytics/limits dashboard | Unnecessary complexity for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| CTX-01 | Phase 1 | Pending |
| CTX-02 | Phase 1 | Pending |
| CTX-03 | Phase 1 | Pending |
| CTX-04 | Phase 1 | Pending |
| CTX-05 | Phase 1 | Pending |
| CTX-06 | Phase 1 | Pending |
| ONB-01 | Phase 2 | Pending |
| ONB-02 | Phase 2 | Pending |
| ONB-03 | Phase 2 | Pending |
| ONB-04 | Phase 2 | Pending |
| ONB-05 | Phase 2 | Pending |
| GATE-01 | Phase 3 | Pending |
| GATE-02 | Phase 3 | Pending |
| GATE-03 | Phase 3 | Pending |
| GATE-04 | Phase 3 | Pending |
| GATE-05 | Phase 3 | Pending |
| GATE-06 | Phase 3 | Pending |
| NAV-01 | Phase 4 | Pending |
| NAV-02 | Phase 4 | Pending |
| NAV-03 | Phase 4 | Pending |
| PAY-01 | Phase 5 | Pending |
| PAY-02 | Phase 5 | Pending |
| PAY-03 | Phase 5 | Pending |
| PAY-04 | Phase 5 | Pending |
| PAY-05 | Phase 5 | Pending |
| PAY-06 | Phase 5 | Pending |
| UPG-01 | Phase 5 | Pending |
| UPG-02 | Phase 5 | Pending |
| UPG-03 | Phase 5 | Pending |
| UPG-04 | Phase 5 | Pending |
| UPG-05 | Phase 5 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after initial definition*
