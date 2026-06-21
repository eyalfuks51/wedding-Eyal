# Wedding RSVP Platform — Freemium PLG & Multi-Event

## What This Is

A multi-tenant Wedding RSVP SaaS platform (React + Supabase) that lets couples create wedding event pages, manage guest lists, and automate WhatsApp follow-ups. This milestone adds a freemium product-led growth (PLG) model with multi-event support and super admin capabilities on top of the existing working platform.

## Core Value

Any couple can sign up, create a wedding event page, and start collecting RSVPs immediately — free tier limitations gently guide them toward upgrading when they need more power.

## Requirements

### Validated

- ✓ Public event pages via `/:slug` with pluggable template system — existing
- ✓ RSVP form submission with phone upsert and Google Sheets sync — existing
- ✓ Admin dashboard with guest table, KPI cards, filters, bulk actions — existing
- ✓ WhatsApp automation pipeline (icebreaker → nudges → ultimatum → logistics → hangover) — existing
- ✓ Automation timeline UI with stage editing, dynamic nudges, auto-pilot toggle — existing
- ✓ Event settings editor with live preview — existing
- ✓ Google OAuth authentication — existing
- ✓ Onboarding wizard for new event creation — existing
- ✓ Guest upload/export via Excel — existing
- ✓ Message history and per-stage log drill-down — existing

### Active

- [ ] Add `is_super_admin` boolean to `public.users` table (manual DB flag)
- [ ] Refactor EventContext to fetch array of events (all for super admin, user_events-linked for regular users)
- [ ] Manage `currentEvent` state with localStorage persistence and `switchEvent(id)` method
- [ ] Onboarding creates events with `status='draft'`, shows success with live public link
- [ ] Onboarding is standalone (no DashboardNav rendered)
- [ ] Unified feature gating via `useFeatureAccess` based on event status (draft vs active)
- [ ] Feature flags: `canAccessSettings` (always), `canAccessTimeline/Import/Export/SendMessages` (active only), `maxFreeGuests: 20`
- [ ] Event Switcher dropdown in DashboardNav (visible when >1 event or super admin)
- [ ] "Create New Event" link in Event Switcher pointing to `/onboarding`
- [ ] Paywall intercepts on Timeline tab (full placeholder for draft events)
- [ ] Paywall intercepts on Import, Export, Add Guest (at 20 limit), and Bulk Send buttons
- [ ] Reusable UpgradeModal component with premium benefits explanation and "Coming Soon" CTA
- [ ] ProtectedRoute handles multi-event (no event = onboarding, has events = dashboard)

### Out of Scope

- Payment gateway integration — future Phase 3 (UpgradeModal shows "Coming Soon")
- Draft mode banner across dashboard — decided against, modals-only approach
- Admin UI for managing super admin status — manual DB only
- Per-feature pricing tiers — single draft/active binary for now
- Event deletion or archival — not in this milestone

## Context

**Existing codebase:** React 19 + Vite 7 SPA, Supabase backend (PostgreSQL + Edge Functions), Vercel deployment. Mixed JS/TS. Dashboard uses Tailwind + Radix UI + GlassCard components. All Hebrew RTL.

**Current state:** Single-event per user via `user_events` join table. `EventContext` fetches one event. `useFeatureAccess` exists but is minimal (just `canManageGuests` and `canUseWhatsApp` based on `isActive`). Events have a `status` column ('draft'/'active') added in auth migration but not fully leveraged for gating.

**Key files to modify:**
- `supabase/migrations/` — new migration for `is_super_admin`
- `src/contexts/EventContext.tsx` — multi-event array + switcher
- `src/hooks/useFeatureAccess.ts` — expanded feature flags
- `src/components/auth/ProtectedRoute.tsx` — multi-event routing
- `src/components/dashboard/DashboardNav.tsx` — event switcher dropdown
- `src/pages/OnboardingPage.tsx` — standalone wizard + success UX
- `src/pages/Dashboard.tsx` — paywall intercepts on buttons
- `src/pages/AutomationTimeline.tsx` — full paywall placeholder
- `src/components/ui/UpgradeModal.tsx` — new file
- `src/lib/supabase.js` — new query functions for multi-event

## Constraints

- **Tech stack:** Must use existing React + Supabase + Tailwind stack. No new dependencies.
- **RTL:** All new UI must be Hebrew RTL. Use `font-brand` / `font-danidin` Tailwind utilities.
- **Design system:** Use existing GlassCard, Sheet, and Radix Dialog patterns for new modals.
- **Backward compatibility:** Existing event data and slug-based public pages must continue working unchanged.
- **No breaking migrations:** `is_super_admin` defaults to false, all existing users unaffected.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Draft/Active binary instead of tiered pricing | Simplest freemium model, payment gateway is Phase 3 | — Pending |
| Super admin via manual DB flag only | Low-priority admin feature, no UI needed yet | — Pending |
| localStorage for currentEventId persistence | Simple, no server round-trip, survives page refresh | — Pending |
| Modals-only for upgrade prompts (no persistent banner) | Less intrusive UX, prompts at point of action | — Pending |
| UpgradeModal CTA shows "Coming Soon" toast | Payment gateway not yet built | — Pending |
| Event activation via future payment gate | For now manual, later triggered by payment | — Pending |

---
*Last updated: 2026-03-16 after initialization*
