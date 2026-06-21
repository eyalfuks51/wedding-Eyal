# Testing

## Current State

**No test infrastructure exists.** There are no test files, no test framework configured, and no testing dependencies in `package.json`.

## What's Missing

- **No test framework:** No Jest, Vitest, Mocha, or any test runner
- **No test files:** Zero `*.test.*`, `*.spec.*`, or `__tests__/` directories
- **No testing utilities:** No React Testing Library, no Enzyme, no MSW for API mocking
- **No E2E testing:** No Cypress, Playwright, or Selenium
- **No CI/CD pipeline:** No GitHub Actions, no automated test runs

## Available Lint/Quality Tools

| Tool | Config | Scope |
|------|--------|-------|
| ESLint 9 | `eslint.config.js` | `**/*.{js,jsx}` only (TS files excluded) |
| TypeScript | `tsconfig.json` | `strict: false`, `checkJs: false` — minimal type checking |

## ESLint Rules

- `js.configs.recommended` — baseline JS rules
- `react-hooks/recommended` — hook dependency checks
- `react-refresh` — Vite HMR compatibility
- Custom: `no-unused-vars` with `varsIgnorePattern: '^[A-Z_]'` (allows unused uppercase/underscore vars)

## Testability Assessment

### Easy to Test
- **`src/lib/supabase.js`** — pure data access functions, could be tested with mocked Supabase client
- **`src/lib/guest-excel.ts`** — pure parsing logic, FileReader can be mocked
- **`src/lib/utils.ts`** — trivial `cn()` utility
- **`src/components/dashboard/constants.ts`** — pure data, no logic to test

### Medium Complexity
- **Edge functions** — Deno `serve()` handlers could be tested with request/response mocks
- **Template components** — snapshot or visual regression tests possible
- **`useEvent` hook** — standard data-fetching hook, testable with mock provider

### Hard to Test (without refactoring)
- **Dashboard pages** — large monolithic components with many `useState` hooks and inline Supabase calls
- **`AuthContext`** — tightly coupled to Supabase auth API
- **`EventContext`** — depends on authenticated Supabase session

## Recommendations for Future Testing

1. **Add Vitest** — natural fit for Vite projects, zero config
2. **Start with `supabase.js` unit tests** — highest value, lowest effort
3. **Add React Testing Library** for component tests
4. **Mock Supabase client** at the module level for isolated tests
5. **Consider Playwright** for critical RSVP flow E2E tests
