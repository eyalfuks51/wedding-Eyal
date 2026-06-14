# Guesto Marketing Landing Next - Completion Report

**Branch:** `feature/guesto-marketing-landing-next`  
**Base:** local `feature/guesto-p0-launch-safety` at `e66c89d28748f2d0a2291aca3aa077ffe328fc47`  
**Date:** 2026-06-14  
**Scope:** marketing landing/front door only. Existing Vite product app, dashboard, onboarding, RSVP templates, Supabase auth, event management, WhatsApp, premium gating, backend, DB, RLS, RPC, migrations, deployment, and push state were not migrated or changed.

## P0 gate

- Verified local branch `feature/guesto-p0-launch-safety` exists.
- Verified the P0 branch tree included `REPORT.md` before work started.
- Created isolated worktree and branch: `.worktrees/guesto-marketing-landing-next`.
- P0 status remains as reported by its source report: not pushed/deployed, migrations not applied, secret rotation external.

## Structure

- `apps/marketing/`: separate Next.js App Router marketing app.
- `apps/marketing/app/page.tsx`: single Hebrew RTL homepage.
- `apps/marketing/app/layout.tsx`: metadata, canonical, Open Graph, RTL HTML.
- `apps/marketing/app/robots.ts`: indexable marketing robots.
- `apps/marketing/app/sitemap.ts`: single homepage sitemap.
- `apps/marketing/app/opengraph-image.tsx`: generated OG image.
- `apps/marketing/app/globals.css`: local-font CSS and visual system.
- `apps/marketing/public/fonts/`: copied Polin and Danidin font files from the product app.
- `apps/marketing/README.md`: local commands, env vars, and routing/domain plan.
- Root `package.json` and `package-lock.json`: npm workspace and marketing scripts.
- `.gitignore` and `eslint.config.js`: ignore generated Next, Playwright, and tsbuild artifacts.

## Impeccable usage

- Ran the impeccable context loader. Result: no `PRODUCT.md`, no `DESIGN.md`.
- Used brand register because this is a landing/marketing surface.
- Derived product-continuity design system from current dashboard/admin UI:
  - Fonts: Polin for body/UI, Danidin for large display headings.
  - Product colors: violet primary, slate/tinted neutrals, emerald/amber/rose status accents.
  - Product shape: rounded operational controls, compact status pills, dashboard rows, phone preview.
  - RTL behavior: Hebrew first, `lang="he"`, `dir="rtl"`, no LTR product shell assumptions.
  - Avoided generic SaaS tells: no gradient text, no fake testimonials/logos, no pricing/payment claim, no hero metric block, no decorative glassmorphism.

## Landing content

- Headline: `הזמנה דיגיטלית לחתונה, מוכנה לשליחה תוך כמה דקות`
- Subheadline: `יוצרים הזמנה יפה בחינם, משתפים בווטסאפ, ומנהלים אישורי הגעה בלי אקסלים מבולגנים.`
- CTA: `צרו הזמנה בחינם`
- CTA target: `${NEXT_PUBLIC_APP_URL}/onboarding`, using the inspected real route `/onboarding`.
- Sections included:
  - Hero with phone/template proof and dashboard RSVP proof.
  - How it works: בוחרים עיצוב, מוסיפים פרטים, משתפים קישור, עוקבים אחרי אישורי הגעה.
  - Template showcase using only registered code templates: `wedding-modern`, `elegant`, `wedding-default`.
  - Free vs advanced based on current gates: free creation/share/basic RSVP up to 20 guests; advanced import/export, WhatsApp timeline, group messages, no free guest limit.
  - WhatsApp-first RSVP management.
  - Final CTA.

## Routing and env plan

Target architecture, documented only:

- `guesto.co.il` and `www.guesto.co.il`: Next marketing app, indexable.
- `app.guesto.co.il`: existing Vite product app, noindex at deployment/header level.
- `invite.guesto.co.il`: existing public invite routes, public by link and noindex.

No deployment restructuring was done. Existing `/:slug` invite routing remains untouched. A later safe transition can map invite traffic to `invite.guesto.co.il/:slug` while preserving old links with redirects.

Env vars:

- `NEXT_PUBLIC_SITE_URL`: canonical marketing origin.
- `NEXT_PUBLIC_APP_URL`: product app origin. CTA resolves to `${NEXT_PUBLIC_APP_URL}/onboarding`.
- `NEXT_PUBLIC_INVITE_URL`: invite origin for public copy examples.

Local verification used:

- `NEXT_PUBLIC_SITE_URL=http://localhost:3007`
- `NEXT_PUBLIC_APP_URL=http://localhost:5173`
- `NEXT_PUBLIC_INVITE_URL=http://localhost:5173`

## Verification

Commands run from the marketing worktree:

- `npm install` - completed. npm audit reports 15 dependency vulnerabilities (5 moderate, 10 high); not fixed in this scope.
- `npm run marketing:typecheck` - pass.
- `npm run marketing:build` - pass. Static routes emitted: `/`, `/_not-found`, `/icon.svg`, `/opengraph-image`, `/robots.txt`, `/sitemap.xml`.
- `npm run build` - pass for existing Vite product app. Existing large chunk warning remains.
- `npx tsc --noEmit` - pass.
- `npm run lint` - pass after ignoring generated `.next` artifacts.
- `npm run test` - pass, 35 tests.
- `npm run test:e2e` - pass, 1 Playwright test. Teardown skipped because local Supabase teardown env vars are not set.

Browser/local render evidence:

- Opened `http://localhost:3007`.
- DOM metadata:
  - `html lang="he" dir="rtl"`.
  - title: `Guesto | הזמנה דיגיטלית לחתונה`.
  - description present.
  - canonical: `http://localhost:3007`.
  - OG title present.
- CTA hrefs all resolved to `http://localhost:5173/onboarding`.
- Desktop overflow probe at 1280x720: no horizontal overflow.
- Mobile overflow probe at 390x844: no horizontal overflow.
- `robots.txt`: `User-Agent: *`, `Allow: /`, sitemap points to `/sitemap.xml`.
- `sitemap.xml`: homepage URL emitted with weekly frequency and priority 1.

Screenshots:

- `apps/marketing/verification/desktop-1280x720.png`
- `apps/marketing/verification/mobile-390x844.png`

## Scope audit

No changes were made under:

- `src/`
- `supabase/`
- `tests/`
- product routes
- dashboard/onboarding/RSVP/template logic
- DB, RLS, RPC, migrations, edge functions, payment, checkout, blog, or CMS

Search over marketing app/package files found no `yourdomain.com`, payment/checkout/blog/CMS implementation, Supabase calls, or SQL/security changes.

## Risks and notes

- The CTA points to the real inspected route `/onboarding`, which is auth-required today. Users may see login before onboarding.
- Product and invite noindex behavior is a deployment/header task. This branch documents the plan but does not restructure deployments.
- npm audit reports dependency vulnerabilities in the combined tree. Fixing them is out of scope and could be breaking.
- The root package lock changed substantially because adding Next.js introduces Next/Turbopack dependencies.
- The marketing screenshots are local render evidence, not final production QA.

## Manual checklist

1. Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_INVITE_URL` in the marketing deployment.
2. Configure domains: marketing on `guesto.co.il`/`www`, product on `app`, invite links on `invite`.
3. Add noindex headers/meta for the product app and invite app at deployment level.
4. Open the production marketing page and confirm canonical/OG/robots/sitemap use the production marketing origin.
5. Click `צרו הזמנה בחינם` and confirm it lands on the product onboarding/login flow at the app origin.
6. Confirm existing invite URLs still work before introducing any redirect plan.
7. Do not apply the P0 migrations, deploy, push main, or rotate secrets as part of this marketing branch.
