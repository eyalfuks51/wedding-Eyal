# Roadmap: Freemium PLG & Multi-Event

## Overview

Transform the existing single-event Wedding RSVP platform into a freemium multi-event SaaS. The journey starts with database foundation and multi-event context, refines the onboarding flow for draft event creation, layers in feature gating logic, adds event switching to the dashboard, and finishes with paywall intercepts and the upgrade modal UI. Each phase builds on the previous -- context must exist before gating can reference it, gating must exist before paywalls can enforce it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Database & Multi-Event Context** - Schema migration and EventContext refactor for multi-event support (completed 2026-03-16)
- [x] **Phase 2: Onboarding Refinement** - Standalone wizard creates draft events with success UX (completed 2026-03-16)
- [x] **Phase 3: Feature Gating** - useFeatureAccess hook enforces draft/active permission boundaries (completed 2026-03-16)
- [x] **Phase 4: Dashboard Navigation** - Event Switcher dropdown and multi-event routing (completed 2026-03-16)
- [x] **Phase 5: Paywalls & Upgrade Modal** - Intercept premium actions with UpgradeModal for draft events (completed 2026-03-16)
- [x] **Phase 6: RSVP Architecture Refactor & Tech Debt Cleanup** - Inclusive RSVP flow with unmatched guest handling, legacy trigger/webhook removal (completed 2026-03-17)
- [x] **Phase 7: Testing & QA Infrastructure** - Vitest unit tests, phone normalization coverage, mandatory test standard for all future phases (completed 2026-03-17)
- [ ] **Phase 8: E2E Testing Foundation** - Playwright RSVP flow test with database teardown against dedicated test event
- [x] **Phase 9: Phase 6 Documentation Retrofix** - Register orphaned RSVP requirements and create Phase 6 verification artifacts (Gap Closure) (completed 2026-03-18)
- [ ] **Phase 10: Integration Fixes & Code Quality** - Fix auth refresh, onboarding race, nav gating, stale data flash, and clean up tech debt (Gap Closure)

## Phase Details

### Phase 1: Database & Multi-Event Context
**Goal**: Users with multiple events can switch between them, and super admins can see all events across the platform
**Depends on**: Nothing (first phase)
**Requirements**: DB-01, DB-02, CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, CTX-06, AUTH-01, AUTH-02
**Success Criteria** (what must be TRUE):
  1. A user who owns two events sees both events available in the application after login
  2. A super admin user can access events they did not create
  3. Refreshing the browser preserves the previously selected event (localStorage persistence)
  4. A user with no events is redirected to onboarding; a user with events lands on the dashboard
  5. All existing single-event users and public slug pages continue working without changes
**Plans:** 2/2 plans complete

Plans:
- [ ] 01-01-PLAN.md -- Migration (is_super_admin + super admin RLS) + query functions + AuthContext extension
- [ ] 01-02-PLAN.md -- EventContext multi-event refactor + ProtectedRoute + dashboard consumer updates

### Phase 2: Onboarding Refinement
**Goal**: New users complete a standalone wizard that creates a draft event and shows them their live public link
**Depends on**: Phase 1
**Requirements**: ONB-01, ONB-02, ONB-03, ONB-04, ONB-05
**Success Criteria** (what must be TRUE):
  1. The onboarding page renders without DashboardNav -- it is a standalone experience
  2. Completing the wizard creates an event with status 'draft' and a working public URL
  3. After completion, the user sees a success screen with their live link, then is redirected to /dashboard/settings
  4. The new event appears in the user's event list (via user_events join)
**Plans:** 2/2 plans complete

Plans:
- [ ] 02-01-PLAN.md -- Data layer fixes (createOnboardingEvent + slug generation) + auth guard on /onboarding
- [ ] 02-02-PLAN.md -- Step 4 success screen with live link, copy button, and redirect to settings

### Phase 3: Feature Gating
**Goal**: Draft event users can only access settings, while active event users have full platform access
**Depends on**: Phase 1
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06
**Success Criteria** (what must be TRUE):
  1. A user with a draft event can access /dashboard/settings without restriction
  2. A user with a draft event is denied access to Timeline, Import, Export, and Send Messages features
  3. A user with an active event can access all features without restriction
  4. The free guest limit of 20 is enforced for draft events
**Plans:** 1/1 plans complete

Plans:
- [ ] 03-01-PLAN.md -- Refactor useFeatureAccess to six granular flags + update all consumer files

### Phase 4: Dashboard Navigation
**Goal**: Users with multiple events can switch between them from the dashboard header
**Depends on**: Phase 1
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. A user with two or more events sees an Event Switcher dropdown in DashboardNav
  2. A user with exactly one event (non-super-admin) does not see the Event Switcher
  3. The Event Switcher includes a "Create New Event" link that navigates to /onboarding
  4. Selecting a different event from the dropdown switches the dashboard context immediately
**Plans:** 1/1 plans complete

Plans:
- [x] 04-01-PLAN.md -- EventSwitcher component + DashboardNav integration

### Phase 5: Paywalls & Upgrade Modal
**Goal**: Draft event users encounter clear upgrade prompts when attempting premium actions
**Depends on**: Phase 3
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, UPG-01, UPG-02, UPG-03, UPG-04, UPG-05
**Success Criteria** (what must be TRUE):
  1. A draft event user navigating to Timeline sees a full-page premium placeholder instead of the pipeline
  2. A draft event user clicking Import, Export, or Send Message buttons sees the UpgradeModal
  3. A draft event user adding a guest beyond the 20-guest limit sees the UpgradeModal
  4. The UpgradeModal displays premium benefits in Hebrew RTL and its CTA button shows a "Coming Soon" toast
  5. An active event user never encounters any paywall intercepts
**Plans:** 3/3 plans complete

Plans:
- [ ] 05-01-PLAN.md -- UpgradeModal component + DashboardNav Timeline tab visibility fix
- [ ] 05-02-PLAN.md -- Dashboard.tsx paywall intercepts (Import, Export, Add Guest, Send Message, bulk Export)
- [ ] 05-03-PLAN.md -- AutomationTimeline premium placeholder for draft users

### Phase 6: RSVP Architecture Refactor & Tech Debt Cleanup
**Goal**: Implement an inclusive RSVP flow where unmatched guests are accepted and flagged for admin review, and remove legacy Google Sheets sync infrastructure
**Depends on**: Phase 1
**Requirements**: RSVP-01, RSVP-02, RSVP-03, RSVP-04, RSVP-05
**Success Criteria** (what must be TRUE):
  1. A guest submitting an RSVP with a phone not in `invitations` is saved with `match_status = 'unmatched'`
  2. A guest submitting an RSVP with a phone that matches an invitation is saved with `match_status = 'matched'` and the invitation is updated
  3. The legacy duplicate trigger `sync_rsvp_to_invitations` is removed
  4. The Google Sheets webhook trigger and edge function dependency are fully removed
  5. Admin dashboard surfaces unmatched RSVPs for manual linking or new invitation creation

**Tasks:**
- [x] **6.1 DB:** Add `invitation_id` (uuid FK) and `match_status` (text: 'matched'/'unmatched') columns to `arrival_permits`
- [x] **6.2 DB:** Rewrite `sync_arrival_to_invitation` trigger to set `match_status` and `invitation_id` on match, allow insert on no-match
- [x] **6.3 DB:** Drop legacy duplicate trigger `sync_rsvp_to_invitations` and its function
- [x] **6.4 DB:** Remove Google Sheets webhook trigger (`sheets_sync_trigger`) entirely
- [x] **6.5 UI:** Add "Unmatched RSVPs" section/filter in Admin Dashboard for admin review and linking

Plans:
- [x] 06-01-PLAN.md -- Database migration (schema changes + trigger rewrite + legacy cleanup)

### Phase 7: Testing & QA Infrastructure
**Goal**: Establish a robust testing foundation with Vitest for unit tests and enforce a mandatory testing standard for all future development phases
**Depends on**: Nothing (infrastructure phase)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Vitest is configured and `npm run test` runs successfully
  2. Phone normalization logic (`phone_core` equivalents, format handling) has comprehensive unit tests covering edge cases: `05x`, `+972`, `972`, with/without dashes, spaces, and international formats
  3. CLAUDE.md development workflow section mandates E2E (Playwright) and unit tests (Vitest) as a completion requirement for all future phases

**Tasks:**
- [ ] **7.1 Infra:** Install and configure Vitest with proper TypeScript/JSX support
- [ ] **7.2 Tests:** Write unit tests for phone normalization logic (05x, +972, 972, dashes, spaces, edge cases)
- [ ] **7.3 Docs:** Update CLAUDE.md to mandate testing verification (Vitest + Playwright) before any phase can be marked complete

Plans:
- [x] 07-01-PLAN.md -- Vitest setup, phone normalization tests, CLAUDE.md testing mandate

### Phase 8: E2E Testing Foundation
**Goal**: Build a complete Playwright E2E test for the RSVP submission flow using a dedicated test event, with strict database teardown to keep the environment clean
**Depends on**: Phase 7
**Requirements**: E2E-01, E2E-02
**Success Criteria** (what must be TRUE):
  1. A Playwright test navigates to the RSVP form for the test event (`event_id: f95c0196-1fa7-441c-bc36-c0f9e833f2e8`), fills dummy data, submits, and asserts success feedback
  2. After the test (pass or fail), a teardown step using the Supabase client deletes the dummy submission from `arrival_permits`, leaving the database perfectly clean

Plans:
- [ ] 08-01-PLAN.md -- Playwright RSVP flow test with Supabase teardown

### Phase 9: Phase 6 Documentation Retrofix
**Goal**: Formally register the 5 orphaned RSVP requirements and create retroactive verification artifacts for Phase 6, which was executed outside the GSD workflow
**Depends on**: Phase 6
**Requirements**: RSVP-01, RSVP-02, RSVP-03, RSVP-04, RSVP-05
**Gap Closure:** Closes orphaned requirements from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. RSVP-01 through RSVP-05 are registered in REQUIREMENTS.md with checkboxes and traceability entries
  2. Phase 6 has a VERIFICATION.md confirming all 5 requirements are satisfied (code already exists)
  3. Phase 6 planning directory exists with proper artifacts
**Plans:** 1/1 plans complete

Plans:
- [ ] 09-01-PLAN.md -- Register RSVP requirements + create Phase 6 verification artifacts

### Phase 10: Integration Fixes & Code Quality
**Goal**: Fix cross-phase integration bugs (auth refresh, onboarding race, nav gating, stale data) and clean up tech debt (dead code, divergent imports, cosmetic casts)
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4
**Requirements**: INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-07
**Gap Closure:** Closes integration, flow, and tech debt gaps from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. Super admin retains `isSuperAdmin = true` after token refresh without page reload
  2. Onboarding completion reliably navigates to `/dashboard/settings` without redirect-back race
  3. Draft users do not see the Timeline tab in `DashboardNav`
  4. Switching events in the dashboard does not flash previous event's data
  5. `AddGuestModal` uses the canonical `normalisePhone` from `phone.ts`
  6. `fetchEventForUser` (dead code) removed from supabase.js; unused `Navigate` import removed from Dashboard.tsx
  7. Cosmetic type casts in EventContext.tsx and AutomationTimeline.tsx are cleaned up
**Plans:** 1/2 plans executed

Plans:
- [ ] 10-01-PLAN.md -- Behavioral fixes: auth refresh, onboarding race, nav gating, stale data flash
- [ ] 10-02-PLAN.md -- Code cleanup: canonical phone import, dead code removal, type cast cleanup

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database & Multi-Event Context | 2/2 | Complete   | 2026-03-16 |
| 2. Onboarding Refinement | 2/2 | Complete   | 2026-03-16 |
| 3. Feature Gating | 1/1 | Complete   | 2026-03-16 |
| 4. Dashboard Navigation | 1/1 | Complete   | 2026-03-16 |
| 5. Paywalls & Upgrade Modal | 3/3 | Complete   | 2026-03-16 |
| 6. RSVP Architecture Refactor & Tech Debt Cleanup | 1/1 | Complete   | 2026-03-17 |
| 7. Testing & QA Infrastructure | 1/1 | Complete   | 2026-03-17 |
| 8. E2E Testing Foundation | 0/1 | Not Started | - |
| 9. Phase 6 Documentation Retrofix | 1/1 | Complete   | 2026-03-18 |
| 10. Integration Fixes & Code Quality | 1/2 | In Progress|  |
