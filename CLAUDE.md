# Project: Guesto — Wedding RSVP + WhatsApp automation SaaS

> **This file is a router, not the manual.** It carries only the always-true rules and a map.
> Load the `docs/` file for the subsystem you're touching — don't read them all. Detailed
> context lives there and in `memory/` (gotchas) + claude-mem (semantic history), so this
> stays small and cheap to load every session.

## What this is
React frontend (Vite + React Router) + Supabase backend. Multi-tenant: each wedding gets `/:slug`, fetches its own event data, renders via a DB-driven pluggable template system. A `apps/marketing` Next.js app is the separate SEO landing page (npm workspace).

**Roadmap:** Phase 1 ✅ multi-template (DB JSONB config) · Phase 2 🔄 WhatsApp automation & scheduler · Phase 3 ◻ payment gateway for wedding gifts.

## 🚨 Critical rules — always apply

1. **SCHEMA SYNC.** `docs/SCHEMA.md` is the source of truth for tables/columns/RLS/RPC and is **generated** from the live DB by `scripts/gen-context.sql` (run via the `supabase-db` MCP — see the file header for why there's no npm script). After ANY migration that adds/renames a table, column, policy, or RPC: regenerate `docs/SCHEMA.md` before writing frontend/backend code. Never guess column names.

2. **NO PHASE COMPLETE WITHOUT TESTS.** Every phase ships with Vitest (`npm run test`) **and** Playwright (`npm run test:e2e`) passing. Business logic, phone normalization, data mapping, validation → unit tests. RSVP submit, dashboard, navigation → E2E. Run both and report results before calling anything done. Non-negotiable.

3. **RTL-strict Hebrew UI.** Violet-600 accent, slate neutrals, local fonts only (`src/styles/fonts/`). Fonts/utilities in `docs/ARCHITECTURE.md`.

4. **Hardcoded event slug** `'hagit-and-itai'` in the dashboard (single-tenant in practice today).

## Subsystem map — open the doc for the area you touch
| Working on… | Read |
|---|---|
| DB columns, RLS, RPC signatures (generated) | [docs/SCHEMA.md](docs/SCHEMA.md) |
| RLS model, P0 grants, auth hardening | [docs/SECURITY.md](docs/SECURITY.md) |
| `/dashboard` table, settings, Timeline V2 | [docs/DASHBOARD.md](docs/DASHBOARD.md) |
| WhatsApp funnel, scheduler, message queue | [docs/AUTOMATION.md](docs/AUTOMATION.md) |
| Adding/editing a wedding template | [docs/TEMPLATES.md](docs/TEMPLATES.md) |
| Request flow, file structure, fonts, sheets sync, dev/test workflow | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| What's in flight right now, next steps, landmines | [STATE.md](STATE.md) |

## Tooling notes
- **TypeScript LSP** plugin is on — fix type/lint diagnostics as you code.
- **Superpowers** plugin available for structured dev (`/superpowers:brainstorm`, `/superpowers:write-plan`) on larger features.
- Regenerate context after schema changes: run `scripts/gen-context.sql` through the `supabase-db` MCP, paste into `docs/SCHEMA.md`, bump its "Generated" date.
