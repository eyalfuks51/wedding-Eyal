# Architecture

## Request flow
- URL `/:slug` → `EventPage` → `useEvent(slug)` → `fetchEventBySlug(slug)` → Supabase
- On RSVP submit, frontend calls the `submit_rsvp` RPC (anon has no direct `arrival_permits` access) → upsert on `(event_id, phone)`
- A Supabase DB webhook triggers the `sync-to-sheets` edge function on `arrival_permits` INSERT/UPDATE → looks up `google_sheet_id` from `events` → syncs the correct Google Sheet

## Google Sheets sync (edge function `sync-to-sheets`)
- Reads `event_id` from the webhook record, queries `events.google_sheet_id` via the service-role client
- Authenticates with a Google service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`)
- Upserts: searches column B for the phone, updates the row if found, appends if not

## Deployment (two Vercel projects, one repo)
- `guesto-marketing` (Next.js, root `apps/marketing`) → SEO landing. `guesto` (Vite SPA, repo root) → `/login`, `/onboarding`, `/dashboard`, invites `/:slug`. Production branch = `main`.
- Landmines: marketing prod build is **skipped on empty commits** (needs a real change under `apps/marketing/`); `NEXT_PUBLIC_*` must be Vercel `type=plain`, never `sensitive`. Full detail in memory `vercel-two-project-monorepo-deploy`.

## Typography
Font files in `src/styles/fonts/` (NOT the root-level `Danidin-CondensedBold-web/` — leftover artifact). `@font-face` in `src/styles/global.scss` (imported via `src/main.jsx`).

| File | Family | Weight | Utility |
|---|---|---|---|
| `Polin-Regular.woff2` | `Polin` | 400 | `font-brand` |
| `Polin-Bold.woff2` | `Polin` | 700 | `font-brand` (bold) |
| `Danidin-CondensedBold.woff2` | `Danidin` | 700 | `font-danidin` |

Tailwind: `brand: ['Polin','Heebo','sans-serif']` (body/labels/UI), `danidin: ['Danidin','Polin','sans-serif']` (display headings, KPI numbers). `preflight: false` — SCSS in `global.scss` owns the reset.
> `preflight:false` leaks native button chrome: a bare `<button>` renders a grey UA box. Flat buttons need `appearance-none bg-transparent border-0`.

## File structure
```
src/
  main.jsx                         BrowserRouter wrapper
  App.jsx                          Routes: /:slug → EventPage, /dashboard*, /onboarding, /login, * → NotFound
  hooks/useEvent.js                fetch event by slug → { event, loading, notFound }
  pages/
    EventPage.jsx                  slug → useEvent → template dispatch
    NotFoundPage.jsx               unknown slugs / root
    Dashboard.tsx                  /dashboard — guest table
    AutomationTimeline.tsx         /dashboard/timeline — funnel pipeline
    DashboardSettings.tsx          /dashboard/settings — settings + live preview
    LoginPage.tsx / OnboardingPage.tsx
  templates/
    WeddingDefaultTemplate/        composes Hero + RsvpForm + Map
    ElegantTemplate/               self-contained dark/gold layout (+ .scss)
  components/
    auth/ProtectedRoute            redirect signed-out → /login
    Hero/ RsvpForm/ Map/           all accept optional config/eventId props
    ui/glass-card.tsx, sheet.tsx   GlassCard family, Sheet drawer (@radix-ui/react-dialog)
    dashboard/                     constants.ts, DashboardNav, EditGuestSheet, StageEditModal,
                                   StageLogsSheet, GuestUploadModal, LivePreview
  lib/
    supabase.js                    fetchEventBySlug, submitRsvp, fetch/updateAutomationSetting,
                                   updateWhatsAppTemplate, fetchMessageStatsPerStage,
                                   fetchStageMessageLogs, toggleAutoPilot, add/deleteDynamicNudge,
                                   bulkUpsertInvitations, updateEventContentConfig
    guest-excel.ts                 Excel template download + upload parser
```

## Dev workflow & quality
- **TypeScript LSP** plugin enabled — fix type/lint diagnostics as you code, before proceeding.
- **RTL strictly** (Hebrew). Local fonts only (see Typography).
- **Testing is mandatory** (see [../CLAUDE.md](../CLAUDE.md) critical rules): Vitest `npm run test` (logic, phone normalization, data mapping, validation) + Playwright `npm run test:e2e` (RSVP submit, dashboard, navigation). Tests live as `*.test.ts` / `src/__tests__/` and `tests/*.spec.ts`. Run both and report results before marking any phase complete.
