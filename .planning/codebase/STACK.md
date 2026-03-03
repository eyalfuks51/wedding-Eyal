# Technology Stack

**Analysis Date:** 2026-03-03

## Languages

**Primary:**
- JavaScript (ES2020, ES2024 syntax support) - Frontend React components, utilities, hooks
- TypeScript (4.x, strict mode disabled) - Type annotations for context, hooks, dashboard pages, edge functions
- JSX/TSX - React component syntax throughout

**Secondary:**
- SCSS 1.97.3 - Component styling, template designs, global styles
- BASH/Shell - Build scripts, Supabase migrations
- Deno - Supabase edge functions (TypeScript runtime)

## Runtime

**Environment:**
- Node.js 18+ (inferred from ES2020+ target)

**Package Manager:**
- npm (lockfile: `package-lock.json` present)

## Frameworks

**Core:**
- React 19.2.0 - Main UI framework
- React Router 7.13.0 - Client-side routing (public event pages + protected admin dashboard)
- React DOM 19.2.0 - DOM rendering

**Styling & UI Components:**
- Tailwind CSS 3.4.19 - Utility-first CSS with custom font configuration
- PostCSS 8.5.6 + Autoprefixer 10.4.24 - CSS processing pipeline
- SCSS/Sass 1.97.3 - Compiled stylesheets for components and templates
- Radix UI primitives:
  - `@radix-ui/react-dialog` 1.1.15 - Modal/Sheet primitives
  - `@radix-ui/react-label` 2.1.8 - Form labels
  - `@radix-ui/react-slot` 1.2.4 - Slot composition pattern
- class-variance-authority 0.7.1 - Component variant system
- clsx 2.1.1 - Conditional class name merging
- tailwind-merge 3.5.0 - Smart Tailwind class merging

**Icons & Graphics:**
- Lucide React 0.575.0 - SVG icon library (used in dashboard, timeline, forms)
- GSAP 3.14.2 - Animation library (scroll animations in Hero, RsvpForm, Map components, ElegantTemplate)

**Tables & Data Export:**
- xlsx 0.18.5 - Excel file parsing and generation (guest upload/download in dashboard)
- file-saver 2.0.5 - Client-side file download utility

## Testing & Development

**Linting:**
- ESLint 9.39.1 - JavaScript/JSX linting
  - @eslint/js 9.39.1 - ESLint recommended rules
  - eslint-plugin-react-hooks 7.0.1 - React hooks rules
  - eslint-plugin-react-refresh 0.4.24 - Vite/React refresh support
- Globals 16.5.0 - Global variable definitions for ESLint

**Build & Dev Server:**
- Vite 7.2.4 - Build tool and dev server
- @vitejs/plugin-react 5.1.1 - React JSX/Fast Refresh support

**Code Generation & Types:**
- @types/react 19.2.5 - React type definitions
- @types/react-dom 19.2.3 - React DOM type definitions
- @types/file-saver 2.0.7 - file-saver type definitions

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.94.0 - Supabase client for database, auth, and RPC calls
  - Used in: `src/lib/supabase.js`, `src/contexts/AuthContext.tsx`, all dashboard pages
  - Provides: Real-time subscriptions, PostgreSQL client, authentication state management
- react-router-dom 7.13.0 - Client routing for multi-page SPA

**Infrastructure:**
- Supabase (PostgreSQL backend) - Primary data store and authentication
- Deno runtime - Supabase edge function runtime (`supabase/functions/`)

## Configuration

**Environment:**
- `.env.local` - Local development credentials (not committed)
- `.env.example` - Template for required environment variables
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous API key

**Build Configuration:**
- `vite.config.js` - Vite configuration with React plugin and path aliases
  - CSS processing: PostCSS + Tailwind + Autoprefixer (inlined)
  - Path alias: `@/` resolves to `./src/`
- `tailwind.config.js` - Custom font families (`font-brand` = Polin, `font-danidin` = Danidin)
  - Disables preflight (CSS reset handled by `src/styles/global.scss`)
- `postcss.config.js` - PostCSS plugins (tailwindcss, autoprefixer)
- `tsconfig.json` - TypeScript configuration
  - Target: ES2020
  - JSX: react-jsx (automatic JSX runtime)
  - Strict mode disabled
  - Base URL and path aliases configured
- `eslint.config.js` - ESLint flat config with React hooks and refresh plugins

**Development Entry Points:**
- `src/main.jsx` - React app root with BrowserRouter + AuthProvider
- `index.html` - HTML entry point (served by Vite)

## Platform Requirements

**Development:**
- Node.js 18+
- npm 8+ (or compatible package manager)
- Supabase account with configured database

**Production:**
- Vite build output (`dist/`) deployable to any static hosting (Vercel, Netlify, etc.)
- Supabase cloud backend (or self-hosted Supabase instance)
- Deno-compatible runtime for Supabase edge functions (provided by Supabase platform)

---

*Stack analysis: 2026-03-03*
