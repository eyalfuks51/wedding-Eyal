# Guesto Marketing App

This is the separate SEO-friendly Next.js front door for Guesto.

## Local commands

- `npm run marketing:dev`
- `npm run marketing:build`
- `npm run marketing:typecheck`

## Environment

- `NEXT_PUBLIC_SITE_URL`: canonical marketing origin, for example the future `https://guesto.co.il`
- `NEXT_PUBLIC_APP_URL`: product app origin. The landing CTA resolves to `${NEXT_PUBLIC_APP_URL}/onboarding`
- `NEXT_PUBLIC_INVITE_URL`: invite origin used only for public copy examples

Local defaults use `http://localhost:3000` for the marketing app and `http://localhost:5173` for the existing Vite product app.

## Routing plan

- `guesto.co.il` and `www.guesto.co.il`: this marketing app, indexable.
- `app.guesto.co.il`: existing Vite product app, noindex at deployment/header level.
- `invite.guesto.co.il`: existing Vite invite routes, public by link and noindex.

The current product app can still use `/:slug` for invites. This branch does not rename, migrate, or restructure those routes. A safe transition later can map invite traffic to `invite.guesto.co.il/:slug` while leaving old links as redirects.

## Deployment (interim)

Two Vercel projects build from this one repo, split by which app serves the request:

| Project | Live URL | Vercel Root Directory | Serves |
|---|---|---|---|
| `guesto-marketing` | https://guesto-marketing-eyalfuks51s-projects.vercel.app | `apps/marketing` | this Next.js landing page (indexable) |
| `guesto` | https://guesto-xi.vercel.app | repo root | Vite product app — `/login`, `/onboarding`, `/dashboard`, invites at `/:slug` |

Production branch is `main`; pushes to other branches build as Vercel Previews. The marketing project enables Vercel's monorepo "skip build when no change in Root Directory" — an **empty** commit will be skipped, so a production rebuild needs a real change under `apps/marketing/`. When `guesto.co.il` is purchased, point the apex + `www` at `guesto-marketing`, `app.` at `guesto`, and update the three `NEXT_PUBLIC_*` origins above.
