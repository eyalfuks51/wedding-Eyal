# Requirements: Wedding RSVP Platform — Freemium PLG & Multi-Event

**Defined:** 2026-03-16
**Core Value:** Any couple can sign up, create a wedding event, and start collecting RSVPs immediately — free tier gently guides toward upgrade.

## v1 Requirements

### Database & Schema

- [x] **DB-01**: `public.users` table has `is_super_admin` boolean column (default false)
- [x] **DB-02**: Migration is non-breaking — all existing users get `is_super_admin = false`

### Multi-Event Context

- [x] **CTX-01**: `EventContext` fetches array of events for the authenticated user
- [x] **CTX-02**: Super admin users (`is_super_admin = true`) can fetch all events across the platform
- [x] **CTX-03**: Regular users see only events linked via `user_events` join table
- [x] **CTX-04**: `currentEvent` state managed in context with `switchEvent(id)` method
- [x] **CTX-05**: `currentEventId` persisted in localStorage, falls back to first event on fresh login
- [x] **CTX-06**: `supabase.js` has query functions for multi-event fetching (all events + user events)

### Onboarding

- [x] **ONB-01**: Onboarding page is standalone — does NOT render `DashboardNav`
- [x] **ONB-02**: Wizard creates event with `status = 'draft'` and auto-generates slug
- [x] **ONB-03**: Wizard links new event to user via `user_events` table
- [x] **ONB-04**: On completion, user sees success UI with their live public link (`/:slug`)
- [x] **ONB-05**: After success, user is redirected to `/dashboard/settings`

### Feature Gating

- [x] **GATE-01**: `useFeatureAccess` returns `canAccessSettings: true` (always open)
- [x] **GATE-02**: `useFeatureAccess` returns `canAccessTimeline: true` only if event status === 'active'
- [x] **GATE-03**: `useFeatureAccess` returns `canImportGuests: true` only if event status === 'active'
- [x] **GATE-04**: `useFeatureAccess` returns `canExportGuests: true` only if event status === 'active'
- [x] **GATE-05**: `useFeatureAccess` returns `canSendMessages: true` only if event status === 'active'
- [x] **GATE-06**: `useFeatureAccess` returns `maxFreeGuests: 20`

### Dashboard Navigation

- [x] **NAV-01**: Event Switcher dropdown in `DashboardNav` shows list of user's events
- [x] **NAV-02**: Event Switcher only renders when `events.length > 1` or user is super admin
- [x] **NAV-03**: Event Switcher includes "Create New Event" link pointing to `/onboarding`

### Paywall Intercepts

- [x] **PAY-01**: Timeline tab renders "Premium Feature / Upgrade" placeholder when `!canAccessTimeline`
- [x] **PAY-02**: Import button opens `UpgradeModal` instead of upload modal when `!canImportGuests`
- [x] **PAY-03**: Export button opens `UpgradeModal` when `!canExportGuests`
- [x] **PAY-04**: Add Guest button opens `UpgradeModal` when guest count >= `maxFreeGuests` and status is 'draft'
- [x] **PAY-05**: "שלח הודעה" (Send Message) bulk action opens `UpgradeModal` when `!canSendMessages`
- [x] **PAY-06**: Bulk Export action opens `UpgradeModal` when `!canExportGuests`

### Upgrade Modal

- [x] **UPG-01**: Reusable `UpgradeModal` component at `src/components/ui/UpgradeModal.tsx`
- [x] **UPG-02**: Modal uses existing design system (GlassCard/Radix Dialog patterns)
- [x] **UPG-03**: Modal explains premium benefits (unlimited guests, Excel import, WhatsApp automation)
- [x] **UPG-04**: "Upgrade" button shows "Coming Soon — Integration with Payment Gateway" toast
- [x] **UPG-05**: Modal is Hebrew RTL with `font-brand` / `font-danidin` typography

### Protected Routes

- [x] **AUTH-01**: `ProtectedRoute` handles multi-event: user with events → dashboard, user with no events → onboarding
- [x] **AUTH-02**: `ProtectedRoute` provides `EventProvider` context to all dashboard pages

### Testing & QA

- [x] **TEST-01**: Vitest configured and `npm run test` runs successfully
- [x] **TEST-02**: Phone normalization has comprehensive unit tests covering 05x, +972, 972, dashes, spaces, edge cases
- [x] **TEST-03**: CLAUDE.md mandates E2E (Playwright) and unit tests (Vitest) as completion requirement for all future phases

### E2E Testing

- [x] **E2E-01**: Playwright test navigates to RSVP form for test event, fills dummy data, submits, and asserts success
- [x] **E2E-02**: Test teardown deletes dummy submission from `arrival_permits` via Supabase client, leaving database clean

### RSVP Architecture

- [x] **RSVP-01**: Unmatched guest saved with `match_status = 'unmatched'` in `arrival_permits`
- [x] **RSVP-02**: Matched guest saved with `match_status = 'matched'` and linked `invitation_id` updated
- [x] **RSVP-03**: Legacy trigger `sync_rsvp_to_invitations` removed
- [x] **RSVP-04**: Google Sheets webhook trigger (`sheets_sync_trigger`) removed
- [x] **RSVP-05**: Admin dashboard surfaces unmatched RSVPs for manual linking or new invitation creation

### Integration & Code Quality (Gap Closure)

- [x] **INT-01**: `AuthContext.onAuthStateChange` re-queries `is_super_admin` on token refresh — no stale false value
- [x] **INT-02**: Onboarding → dashboard redirect waits for `user_events` row visibility before navigating
- [x] **INT-03**: `DashboardNav` hides Timeline tab for draft users via `gateKey` (not just in-page paywall)
- [x] **INT-04**: `Dashboard.tsx` clears invitations state before re-fetching on `currentEvent` change — no stale flash
- [x] **INT-05**: `AddGuestModal` imports `normalisePhone` from `phone.ts` instead of inline implementation
- [x] **INT-06**: Dead code removed: orphaned `fetchEventForUser` in supabase.js, unused `Navigate` import in Dashboard.tsx
- [x] **INT-07**: Cosmetic type casts cleaned up in EventContext.tsx and AutomationTimeline.tsx

### Final Polish (Gap Closure)

- [x] **POLISH-01**: `DashboardSettings.tsx` has zero `(currentEvent as any)` casts — uses typed `EventData` properties
- [x] **POLISH-02**: `EventContext` defers initial fetch until `isSuperAdmin` has resolved — no double-fetch flicker for super admins
- [x] **POLISH-03**: All ROADMAP.md plan checkboxes and phase statuses match actual completion state
- [x] **POLISH-04**: `.env.example` documents `VITE_SUPABASE_SERVICE_ROLE_KEY` with E2E teardown explanation

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
| DB-01 | Phase 1 | Complete |
| DB-02 | Phase 1 | Complete |
| CTX-01 | Phase 1 | Complete |
| CTX-02 | Phase 1 | Complete |
| CTX-03 | Phase 1 | Complete |
| CTX-04 | Phase 1 | Complete |
| CTX-05 | Phase 1 | Complete |
| CTX-06 | Phase 1 | Complete |
| ONB-01 | Phase 2 | Complete |
| ONB-02 | Phase 2 | Complete |
| ONB-03 | Phase 2 | Complete |
| ONB-04 | Phase 2 | Complete |
| ONB-05 | Phase 2 | Complete |
| GATE-01 | Phase 3 | Complete |
| GATE-02 | Phase 3 | Complete |
| GATE-03 | Phase 3 | Complete |
| GATE-04 | Phase 3 | Complete |
| GATE-05 | Phase 3 | Complete |
| GATE-06 | Phase 3 | Complete |
| NAV-01 | Phase 4 | Complete |
| NAV-02 | Phase 4 | Complete |
| NAV-03 | Phase 4 | Complete |
| PAY-01 | Phase 5 | Complete |
| PAY-02 | Phase 5 | Complete |
| PAY-03 | Phase 5 | Complete |
| PAY-04 | Phase 5 | Complete |
| PAY-05 | Phase 5 | Complete |
| PAY-06 | Phase 5 | Complete |
| UPG-01 | Phase 5 | Complete |
| UPG-02 | Phase 5 | Complete |
| UPG-03 | Phase 5 | Complete |
| UPG-04 | Phase 5 | Complete |
| UPG-05 | Phase 5 | Complete |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |

| TEST-01 | Phase 7 | Complete |
| TEST-02 | Phase 7 | Complete |
| TEST-03 | Phase 7 | Complete |

| E2E-01 | Phase 8 | Complete |
| E2E-02 | Phase 8 | Complete |

| RSVP-01 | Phase 6 | Complete |
| RSVP-02 | Phase 6 | Complete |
| RSVP-03 | Phase 6 | Complete |
| RSVP-04 | Phase 6 | Complete |
| RSVP-05 | Phase 6 | Complete |

| INT-01 | Phase 10 | Complete |
| INT-02 | Phase 10 | Complete |
| INT-03 | Phase 10 | Complete |
| INT-04 | Phase 10 | Complete |
| INT-05 | Phase 10 | Complete |
| INT-06 | Phase 10 | Complete |
| INT-07 | Phase 10 | Complete |

| POLISH-01 | Phase 11 | Complete |
| POLISH-02 | Phase 11 | Complete |
| POLISH-03 | Phase 11 | Complete |
| POLISH-04 | Phase 11 | Complete |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-18 after gap closure phase creation*
