# Technology Stack

## Languages & Runtime

| Layer | Language | Version |
|-------|----------|---------|
| Frontend | JavaScript (JSX) + TypeScript (TSX) | ES2020 target |
| Backend (Edge Functions) | TypeScript | Deno runtime |
| Database | SQL (PostgreSQL) | via Supabase |
| Styling | SCSS + Tailwind CSS 3 | |

**Mixed JS/TS codebase:** Templates and core pages use `.jsx`, dashboard and newer components use `.tsx`. `strict: false` in `tsconfig.json`, `allowJs: true`.

## Frontend Framework

- **React 19** (`react@^19.2.0`, `react-dom@^19.2.0`)
- **React Router 7** (`react-router-dom@^7.13.0`) — file-based route definitions in `src/App.jsx`
- **Vite 7** (`vite@^7.2.4`) with `@vitejs/plugin-react`
- **Entry point:** `src/main.jsx` → `BrowserRouter` → `AuthProvider` → `App`

## Styling

- **Tailwind CSS 3** (`tailwindcss@^3.4.19`) — `preflight: false` (CSS reset handled by `global.scss`)
- **SCSS** (`sass@^1.97.3`) — variables in `src/styles/_variables.scss`, mixins in `src/styles/_mixins.scss`
- **PostCSS** with `autoprefixer` — configured inline in `vite.config.js`
- **Custom fonts:** Polin (brand body), Danidin (display headings) — `@font-face` in `src/styles/global.scss`
- **Tailwind utilities:** `font-brand` (Polin), `font-danidin` (Danidin) — configured in `tailwind.config.js`
- **cn() utility:** `src/lib/utils.ts` — shadcn-style `clsx` + `tailwind-merge`

## UI Libraries

- **Radix UI:** `@radix-ui/react-dialog` (Sheet drawer), `@radix-ui/react-label`, `@radix-ui/react-slot`
- **Lucide React** (`lucide-react@^0.575.0`) — icon library
- **class-variance-authority** (`cva@^0.7.1`) — component variant management
- **GSAP** (`gsap@^3.14.2`) — scroll animations (used in `WeddingDefaultTemplate`)
- **Custom glass-card component:** `src/components/ui/glass-card.tsx` — glassmorphism card primitives

## Data & Backend

- **Supabase JS** (`@supabase/supabase-js@^2.94.0`) — database client, auth, RPC calls
- **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (via `import.meta.env`)

## File Handling

- **xlsx** (`xlsx@^0.18.5`) — Excel template generation and guest list parsing
- **file-saver** (`file-saver@^2.0.5`) — client-side file download

## Build & Tooling

- **Vite 7** — dev server, HMR, production builds
- **ESLint 9** — `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` (JS/JSX files only)
- **Path aliases:** `@/` → `src/` (configured in both `vite.config.js` and `tsconfig.json`)
- **No test framework configured** — no Jest, Vitest, or testing dependencies

## Deployment

- **Vercel** — `.vercel/project.json` present, Vite build output
- **Supabase Edge Functions** — deployed separately (Deno runtime)

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.js` | Vite + React plugin, PostCSS inline config, `@/` alias |
| `tailwind.config.js` | Content paths, custom font families, `preflight: false` |
| `tsconfig.json` | `strict: false`, `allowJs: true`, `@/*` path alias |
| `eslint.config.js` | ESLint 9 flat config, JS/JSX only |
| `postcss.config.js` | PostCSS config (also inlined in Vite) |
