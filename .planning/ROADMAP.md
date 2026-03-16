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
- [ ] **Phase 4: Dashboard Navigation** - Event Switcher dropdown and multi-event routing
- [ ] **Phase 5: Paywalls & Upgrade Modal** - Intercept premium actions with UpgradeModal for draft events

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
**Plans:** 1 plan

Plans:
- [ ] 04-01-PLAN.md -- EventSwitcher component + DashboardNav integration

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
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database & Multi-Event Context | 2/2 | Complete   | 2026-03-16 |
| 2. Onboarding Refinement | 2/2 | Complete   | 2026-03-16 |
| 3. Feature Gating | 1/1 | Complete   | 2026-03-16 |
| 4. Dashboard Navigation | 0/1 | Not started | - |
| 5. Paywalls & Upgrade Modal | 0/3 | Not started | - |
