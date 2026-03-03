# Coding Conventions

**Analysis Date:** 2026-03-03

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `EditGuestSheet.tsx`, `DashboardNav.tsx`)
- Custom hooks: `use` prefix in camelCase (e.g., `useEvent.js`, `useEventContext.tsx`, `useFeatureAccess.ts`)
- Utility modules: camelCase (e.g., `supabase.js`, `guest-excel.ts`, `utils.ts`)
- Constants files: lowercase with hyphens for multi-word (e.g., `constants.ts`)
- Type/interface files: Same as content (not separate `.d.ts` files)

**Functions:**
- camelCase for all function names (including React components if lowercase, e.g., `submitRsvp`, `fetchEventBySlug`)
- Async functions named descriptively (e.g., `fetchEventBySlug`, `bulkUpsertInvitations`, `updateEventContentConfig`)
- Helper/micro-functions within components often use camelCase (e.g., `handleSubmit`, `handleInputChange`, `setForm`)

**Variables:**
- camelCase for state and local variables (e.g., `eventData`, `formError`, `isSaving`, `phoneToId`)
- UPPER_SNAKE_CASE for module-level constants (e.g., `CANONICAL_STAGES`, `DYNAMIC_NUDGE_NAMES`, `ALL_STAGE_NAMES`, `EMPTY_FORM`)
- Single-letter abbreviations acceptable in tight loops (e.g., `s` for stage, `d` for date)
- Boolean flags prefixed with `is` or `has` (e.g., `isLoading`, `isActive`, `hasError`, `isAutomated`)

**Types:**
- PascalCase for all type/interface names (e.g., `EditGuestSheetProps`, `Invitation`, `RsvpStatus`, `AutomationSettingRow`)
- Type unions and discriminated unions preferred over enums (e.g., `RsvpStatus = 'pending' | 'attending' | 'declined'`)
- Generic types named descriptively (e.g., `WhatsAppTemplates = Record<string, { singular: string; plural: string }>`)

## Code Style

**Formatting:**
- No Prettier config present — code follows ESLint rules and manual consistency
- Semicolons required at end of statements
- Single quotes in JSX attributes and strings (observed in most files)
- Trailing commas in multi-line objects/arrays
- 2-space indentation (standard JS/TS)

**Linting:**
- Tool: ESLint v9.39.1 with flat config (`eslint.config.js`)
- Extends: `@eslint/js` recommended, `eslint-plugin-react-hooks/flat/recommended`, `eslint-plugin-react-refresh/vite`
- Key rule: `no-unused-vars` set to `error` but with pattern `^[A-Z_]` to allow uppercase/underscore-prefixed unused variables (likely for intentional patterns or exports)
- No React-specific linting rule overrides beyond hooks/refresh plugins

**TypeScript:**
- `tsconfig.json` has `strict: false` — type safety is optional, not enforced
- `allowJs: true` and `checkJs: false` — allows mixed `.js` and `.ts` files without type-checking all `.js`
- JSX compiled with `react-jsx` (modern JSX transform, no React import required)

## Import Organization

**Order:**
1. External libraries and React (e.g., `import { useState } from 'react'`)
2. Lucide/UI icons (e.g., `import { Search, Users } from 'lucide-react'`)
3. Local utilities and hooks (e.g., `import { supabase } from '@/lib/supabase'`)
4. Local components (e.g., `import EditGuestSheet from '@/components/dashboard/EditGuestSheet'`)
5. Type imports (e.g., `import type { Invitation } from '@/components/dashboard/EditGuestSheet'`)
6. Local styles (e.g., `import './RsvpForm.scss'`)

**Path Aliases:**
- `@/*` resolves to `./src/*` (configured in `tsconfig.json` and `vite.config.js`)
- Consistently used throughout: `@/lib/supabase`, `@/components/ui/glass-card`, `@/contexts/EventContext`
- Always use alias paths, never relative `../../../` imports

## Error Handling

**Patterns:**
- Async/await with try-catch blocks for error isolation (seen in `supabase.js` module)
- Supabase calls follow consistent pattern: destructure `{ data, error }`, throw on error
  ```javascript
  const { data, error } = await supabase.from('table').select(...);
  if (error) throw error;
  return data;
  ```
- Component-level errors stored in state (e.g., `formError`, `errorMessage`) and displayed to user
- Silent failures logged to console on some error paths (e.g., `console.error`, `console.warn`)
- Cancellation flags used in effect cleanup (e.g., `let cancelled = false; return () => { cancelled = true }`) to prevent state updates on unmounted components
- No global error boundary observed — error handling is per-component or per-async-function

**Error Messages:**
- Hebrew error messages used throughout (e.g., "שגיאה בטעינת הנתונים", "שם קבוצה")
- User-facing messages in Hebrew; internal logging messages can be English or Hebrew
- Generic fallback messages on parse failures (e.g., `'שגיאה לא ידועה'`)

## Logging

**Framework:** `console` only (no logging library)

**Patterns:**
- `console.warn()` for non-critical issues (e.g., Supabase credentials missing)
- `console.error()` for failures and exceptions (e.g., RSVP submission errors)
- Typically logs error message and minimal context
- No structured logging; messages are unformatted strings
- No debug/info/trace levels observed

## Comments

**When to Comment:**
- Section dividers (e.g., `// ─── Types ────────────────────────────────────────────────────────`)
- JSDoc-style block comments for exported functions (e.g., `/** Fetch all automation_settings rows for an event, ordered by days_before DESC */`)
- Inline comments for non-obvious logic or workarounds (e.g., explanation of GSAP animation flow, column width calculations)
- Rarely used for obvious code (most functions are self-documenting)

**JSDoc/TSDoc:**
- Minimal usage observed
- When present, follows standard JSDoc format with `/** ... */` blocks
- Parameters and return types documented in JSDoc (e.g., `/** Update a single automation_settings row (toggle is_active, change days_before) */`)
- `@deprecated` tags used (e.g., `/** @deprecated Use CANONICAL_STAGES or ALL_STAGE_NAMES instead */`)

## Function Design

**Size:**
- Most functions 20–80 lines
- Larger pages/components (e.g., `Dashboard.tsx`) broken into micro-components (e.g., `Spinner`, `ErrorView`, `KpiCard`)
- Utility functions kept focused (e.g., `normalizePhone`, `isValidPhone` are 1–5 lines each)

**Parameters:**
- Destructured object parameters preferred (e.g., `{ invitation, sides, onClose, onSave }`)
- Required parameters passed as direct props; optional params use defaults
- TypeScript interfaces defined for complex prop shapes (e.g., `EditGuestSheetProps`, `KpiCardProps`)

**Return Values:**
- Functions return objects for multiple values (e.g., `{ event, loading, notFound }` from `useEvent`)
- Async functions return single values or throw on error
- Components return JSX or null (for conditional rendering)

## Module Design

**Exports:**
- Named exports for reusable components, hooks, utilities (e.g., `export function EditGuestSheet(...)`)
- Default export for page components (e.g., `export default Dashboard`)
- Type exports with `export type` or `export interface` when types need to be imported elsewhere
- Exported types often re-used to avoid duplication (e.g., `EditGuestSheetProps` imported in `Dashboard.tsx`)

**Barrel Files:**
- NOT used; components are imported from their direct paths (e.g., `@/components/dashboard/EditGuestSheet`, not `@/components/dashboard`)
- Keeps imports explicit and tree-shaking friendly

## Specific Conventions

**React Hooks:**
- Custom hooks follow the `use` prefix convention strictly
- Effect cleanup functions used to prevent state updates on unmounted components
- State names concise (e.g., `loading`, `event`, `saving`) but unambiguous in context

**Tailwind Utilities:**
- Font utilities from custom config: `font-brand` (Polin) for body/UI, `font-danidin` (Danidin) for headings
- Tailwind `preflight: false` in config because `global.scss` handles CSS reset
- Custom class utilities like `cn()` from `@/lib/utils` for conditional class merging (shadcn-style pattern)

**Async/State Management:**
- Local component state with `useState` — no global state management library (e.g., Redux, Zustand)
- Context API used for app-level state (e.g., `EventContext`, `AuthContext`)
- Supabase client (`@/lib/supabase.js`) acts as the single async data layer — all DB calls go through it

---

*Convention analysis: 2026-03-03*
