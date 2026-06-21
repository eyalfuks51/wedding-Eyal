# Coding Conventions

## Language & Type System

- **Mixed JS/TS codebase:** Original pages and templates in `.jsx`, newer dashboard and auth code in `.tsx`
- **TypeScript:** `strict: false`, `allowJs: true`, `checkJs: false` — relaxed typing
- **Interfaces over types:** Dashboard components define interfaces inline (e.g., `interface Invitation`, `interface MessageLog`)
- **No shared type definitions file** — types are defined locally where used, sometimes re-exported (e.g., `Invitation` from `EditGuestSheet.tsx`)

## Component Patterns

### React Components
- **Function components only** — no class components anywhere
- **Named exports** for reusable components (e.g., `export function ProtectedRoute`)
- **Default exports** for pages and templates (e.g., `export default function LoginPage`)
- **Props destructuring** in function signature
- **Hooks at top of component** — standard React hook ordering

### State Management
- **React Context** for global state:
  - `AuthContext` — auth session (user, signOut)
  - `EventContext` — current user's event data (for dashboard)
- **Local state** via `useState` for component-level concerns
- **No Redux, Zustand, or other state libraries**
- **No React Query or SWR** — data fetching is manual `useEffect` + `useState`

### Data Fetching Pattern
```jsx
// Consistent pattern across the codebase:
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  let cancelled = false;
  fetchSomething()
    .then(result => { if (!cancelled) setData(result); })
    .finally(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
}, [dependency]);
```

### Supabase Data Access
- **Centralized in `src/lib/supabase.js`** — all queries, mutations, and RPC calls
- **Thin wrappers:** Each function does one Supabase call, throws on error
- **No caching layer** — every call hits the database directly
- **Error pattern:** `if (error) throw error` — errors bubble to calling component

## Styling Approach

### Dual System: SCSS + Tailwind
- **Templates and shared components:** SCSS files co-located with components
- **Dashboard and newer pages:** Tailwind utility classes inline
- **SCSS variables** (`src/styles/_variables.scss`): colors, spacing, typography, breakpoints
- **SCSS mixins** (`src/styles/_mixins.scss`): responsive breakpoints, flex utilities, button/input bases
- **Global reset** in `src/styles/global.scss` (Tailwind preflight disabled)

### RTL
- All UI is RTL Hebrew — `direction: rtl` set globally in `body`
- `dir="rtl"` also set on individual page root divs
- Tailwind's `text-right` / `text-left` used for alignment overrides

### Design Tokens
- **Primary accent:** `violet-600` (dashboard), `$primary: #800b21` (templates)
- **Neutral palette:** `slate-*` (dashboard)
- **Fonts:** `font-brand` (Polin) for body, `font-danidin` (Danidin) for headings

## Error Handling

- **Supabase functions:** Throw errors with Hebrew messages for user-facing errors
- **Edge functions:** `try/catch` with structured JSON error responses, console.error logging
- **Components:** Minimal error boundaries — errors shown via state variables or toast notifications
- **No global error boundary component**

## File Organization

- **One component per file** (with occasional small helper components in same file)
- **Co-located styles:** SCSS files next to their component (e.g., `Hero/Hero.scss`)
- **Dashboard components flat:** All dashboard-specific components in `src/components/dashboard/`
- **No barrel files (index.ts)** — direct imports from file paths

## Import Style

- **Absolute imports** with `@/` alias for `src/` (e.g., `import { supabase } from '@/lib/supabase'`)
- **Relative imports** also used, especially in older code (e.g., `import { useEvent } from '../hooks/useEvent'`)
- **Named imports preferred** — destructured from modules
- **Lucide icons imported individually** (e.g., `import { Search, Users } from 'lucide-react'`)

## Edge Function Conventions

- **Deno runtime** with URL imports (`https://deno.land/std`, `https://esm.sh/`)
- **`serve()` wrapper** from Deno std library
- **Service role key** for admin operations (bypasses RLS)
- **Console logging** with `[function-name]` prefix for traceability
- **Structured JSON responses** with appropriate HTTP status codes
- **Environment variables** via `Deno.env.get()` with `!` assertion or explicit validation

## Database Conventions

- **Timestamp-prefixed migrations** (e.g., `20260302100000_auth_multitenant_schema.sql`)
- **`SECURITY DEFINER` RPCs** with `SET search_path = public` for safety
- **RLS policies** named descriptively (e.g., `Allow anon select automation_settings`)
- **JSONB for flexible config** (`content_config`, `automation_config` on `events` table)
- **Atomic updates via RPC** — `jsonb_set` for partial JSONB updates instead of full-row replacement
