# Concerns & Technical Debt

## Security

### High Priority
- **Open RLS policies on `arrival_permits`:** Anon can SELECT, INSERT, UPDATE all rows — any user can read/modify any event's RSVP data. No event-scoping in RLS.
- **Open RLS on `automation_settings`:** Anon can read, update, and insert automation settings for any event. Stage name whitelist exists but no event ownership check.
- **Service account credentials in edge functions:** `GOOGLE_PRIVATE_KEY` read at module top level in `sync-to-sheets` — crashes cold start if missing (unlike `whatsapp-scheduler` which validates per-request).
- **No CSRF protection:** Frontend makes unauthenticated writes to `arrival_permits` — any site can submit RSVPs.

### Medium Priority
- **Dashboard not event-scoped in queries:** Although `ProtectedRoute` loads the user's event, individual Supabase queries in `Dashboard.tsx` use `event.id` but RLS doesn't enforce ownership — a modified client could query other events.
- **Supabase anon key exposed:** Standard for Supabase but relies entirely on RLS for security. With permissive RLS policies, this is a concern.
- **`whatsapp-webhook` loads credentials at cold start:** Unlike `whatsapp-scheduler`, the webhook function throws at module level if env vars missing — no graceful degradation.

## Architecture Concerns

### Data Layer
- **No data caching:** Every page load, every tab switch hits Supabase directly. No React Query, SWR, or any caching mechanism. Dashboard with many guests will be slow.
- **Sequential bulk operations:** `bulkUpsertInvitations()` processes guests one-by-one in a loop — no batch insert. Slow for large guest lists (100+ rows).
- **No pagination:** Dashboard fetches ALL invitations at once. Will degrade with hundreds of guests.
- **No optimistic updates:** Every mutation requires a full refetch to see changes.

### Component Size
- **`Dashboard.tsx` is a monolith:** Contains KPI cards, filter bar, guest table, bulk actions, message history, column visibility — all in one file. Likely 600+ lines with complex state management.
- **`AutomationTimeline.tsx`** — similarly large with drag-to-scroll, stage rendering, modals, and mobile/desktop layouts.
- **State management in pages:** All state is local `useState` — no extraction into custom hooks or reducers.

### Template System
- **No template validation:** If `template_id` in DB doesn't match any registered template, silently falls back to `WeddingDefaultTemplate`. No error reporting.
- **Legacy `WeddingTemplate/` directory:** `src/templates/WeddingTemplate/WeddingTemplate.jsx` exists but is not registered in `EventPage.jsx` — dead code.
- **Hardcoded assets per template:** Adding a new template requires manual asset management and code changes — no CMS or asset management system.

## Technical Debt

### Code Quality
- **Mixed JS/TS without migration plan:** New code is `.tsx` but old code remains `.jsx`. No incremental migration strategy. `strict: false` means TS provides minimal safety.
- **ESLint only covers JS/JSX:** TypeScript files (`*.tsx`, `*.ts`) are not linted. No `@typescript-eslint` plugin configured.
- **No test infrastructure at all:** Zero tests, no test framework, no CI. Regressions are caught manually.
- **Inline type definitions:** Types like `Invitation`, `MessageLog` are defined in multiple places rather than a shared types file.
- **`console.log` in production code:** `EventPage.jsx:59` logs template ID on every render. Edge functions have verbose console logging.

### Styling Debt
- **Dual styling systems:** SCSS variables/mixins for templates, Tailwind for dashboard. Two sources of truth for colors, spacing, breakpoints.
- **`global.scss` owns CSS reset:** Tailwind's preflight disabled — potential conflicts when Tailwind classes assume preflight normalization.
- **Hardcoded colors in templates:** Each template has its own color palette in SCSS, not connected to Tailwind theme or SCSS variables.

### Database
- **Hardcoded slug:** `'hagit-and-itai'` referenced in migration `20260302100000` for initial activation — tech debt from single-tenant origin.
- **No database indexes documented:** No explicit indexes in migrations beyond PKs and the `arrival_permits_event_phone_unique` constraint.
- **Edge functions not idempotent:** `automation-engine` deduplicates by checking existing logs, but a partial failure could leave the system in an inconsistent state.

## Performance Concerns

- **No lazy loading:** All template components imported eagerly in `EventPage.jsx` — bundle includes all templates even when only one is used.
- **No code splitting:** Single Vite bundle for the entire app. Dashboard code ships to public event pages.
- **GSAP bundled globally:** `gsap@^3.14.2` is a dependency even though only `WeddingDefaultTemplate` uses it.
- **Full table fetch in Dashboard:** All invitations + all message_logs fetched on mount — no virtual scrolling or pagination.
- **Google Fonts loaded from CDN:** `global.scss` imports multiple Google Fonts families — render-blocking request.

## Fragile Areas

- **Template dispatch map:** Adding a template requires editing `EventPage.jsx` import list AND the `TEMPLATES` object — easy to forget one.
- **WhatsApp template interpolation:** `{{variable}}` replacement in `automation-engine` depends on `content_config` structure matching exactly — no schema validation.
- **Stage name coupling:** Stage names (`icebreaker`, `nudge`, etc.) are strings shared across frontend constants, database rows, edge function logic, and `content_config` JSONB keys — a typo anywhere breaks the chain silently.
- **Phone number normalization:** Three separate implementations: `guest-excel.ts:normalizePhone`, `whatsapp-scheduler:formatIsraeliPhone`, and implicit normalization in `bulkUpsertInvitations` match logic.

## Missing Features (Expected for Production)

- **No rate limiting** on RSVP submissions or API calls
- **No audit logging** — no record of who changed what in the dashboard
- **No backup strategy** documented
- **No monitoring or alerting** — edge function failures only visible in Supabase logs
- **No i18n framework** — Hebrew strings hardcoded throughout, no translation system
