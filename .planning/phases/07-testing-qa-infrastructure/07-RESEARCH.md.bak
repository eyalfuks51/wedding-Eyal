# Phase 7: Testing & QA Infrastructure - Research

**Researched:** 2026-03-17
**Domain:** Vitest unit testing, phone normalization logic, testing workflow enforcement
**Confidence:** HIGH

## Summary

This phase establishes a unit testing foundation using Vitest (already installed as v4.1.0 in devDependencies) and writes comprehensive tests for the phone normalization functions that are critical to the RSVP-to-invitation matching pipeline. The project already has Playwright for E2E tests but has zero unit test infrastructure (no vitest config, no `test` script, no test files).

The phone normalization logic lives in `src/lib/guest-excel.ts` as two private functions (`normalizePhone` and `isValidPhone`). These must be extracted to a shared utility module so they can be tested independently AND reused. A parallel `phone_core` SQL function exists in the database (migration `20260317150000`) with equivalent logic -- the JS tests must cover the same edge cases to ensure parity.

**Primary recommendation:** Extract phone utilities to `src/lib/phone.ts`, configure Vitest in `vite.config.js` (shared config pattern), add `npm run test` script, write comprehensive phone normalization tests, and update CLAUDE.md with mandatory testing requirements.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.0 | Unit test runner | Already installed; native Vite integration, same config, same transforms |
| @vitejs/plugin-react | 5.1.1 | JSX transform for tests | Already installed; Vitest reuses Vite plugins automatically |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test | 1.58.2 | E2E browser tests | Already configured; `tests/rsvp.spec.ts` exists |

### No Additional Installs Needed

Vitest 4.x is already in `devDependencies` and installed. No new packages are required for this phase.

## Architecture Patterns

### Recommended Test Structure
```
src/
  lib/
    phone.ts                    # NEW: extracted phone normalization utilities
    phone.test.ts               # NEW: unit tests co-located with source
    guest-excel.ts              # MODIFIED: imports from phone.ts instead of inline functions
  ...
tests/
  rsvp.spec.ts                 # EXISTING: Playwright E2E test
```

### Pattern 1: Co-located Unit Tests
**What:** Place `.test.ts` files next to the source files they test, within `src/`.
**When to use:** Always for unit tests in this project.
**Why:** Vitest defaults to finding `**/*.test.{ts,tsx}` anywhere in the project. Co-location makes it obvious what's tested. Playwright tests stay in `tests/` (already separated by config).

### Pattern 2: Vitest Config Inside vite.config.js
**What:** Add a `test` block to the existing `vite.config.js` using `/// <reference types="vitest/config" />`.
**When to use:** When the project already has a `vite.config.js` (this project does).
**Why:** Vitest 4.x supports inline config. No separate `vitest.config.ts` file needed. Shares path aliases (`@/`) and plugins automatically.

**Example:**
```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve('./src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',       // phone utils are pure logic, no DOM needed
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'tests'],  // exclude Playwright tests dir
  },
  // ... existing css config
})
```

### Pattern 3: Extract-to-Test for Private Functions
**What:** The `normalizePhone` and `isValidPhone` functions are currently private (non-exported) inside `guest-excel.ts`. Extract them to a dedicated `phone.ts` module with named exports.
**When to use:** When functions need to be tested independently and are reusable.
**Why:** Testing private functions through their public API (the Excel parser) would require mocking the `xlsx` library and constructing complex test fixtures. Direct testing of pure functions is simpler and more robust.

### Anti-Patterns to Avoid
- **Separate vitest.config.ts:** Unnecessary duplication when vite.config.js exists. Vitest reads from vite.config.js natively.
- **Testing phone logic through Excel parser:** Would couple tests to xlsx parsing, making them fragile and slow.
- **Using jsdom environment for pure logic tests:** Phone normalization is pure string manipulation -- no DOM needed. Use `environment: 'node'` for speed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner | Custom scripts | Vitest (already installed) | Watch mode, snapshots, coverage, TypeScript support out of box |
| Phone validation regex | Complex custom regex | Simple digit extraction + prefix rules | The existing `normalizePhone` pattern (strip non-digits, check prefix) is correct and matches the DB `phone_core` function |

## Common Pitfalls

### Pitfall 1: Vitest and Playwright Test Collision
**What goes wrong:** Vitest picks up Playwright test files from `tests/` directory and fails because `@playwright/test` imports don't resolve in Vitest context.
**Why it happens:** Default Vitest glob includes all `*.spec.ts` files.
**How to avoid:** Explicitly set `test.include` to `['src/**/*.test.{ts,tsx}']` and `test.exclude` to include `['tests']` in vitest config. Playwright already has its own `testDir: './tests'` config.
**Warning signs:** Errors about `@playwright/test` module not found when running `npm run test`.

### Pitfall 2: Phone Normalization Parity with Database
**What goes wrong:** JS `normalizePhone` and SQL `phone_core` produce different results for edge cases, causing RSVP-to-invitation matching failures.
**Why it happens:** The JS function and SQL function were written separately. The JS function returns full `972`-prefixed numbers (`0521234567` -> `9721234567`), while `phone_core` returns core digits only (`0521234567` -> `521234567`).
**How to avoid:** Tests must document the EXACT behavior of both functions. The current matching works because the DB trigger calls `phone_core()` on BOTH sides of the comparison. The JS side normalizes for storage (adds `972` prefix). These are different normalization strategies for different purposes -- tests should verify each independently.
**Warning signs:** Guest RSVPs not matching their invitations in the dashboard.

### Pitfall 3: TypeScript Path Aliases in Tests
**What goes wrong:** Tests using `@/lib/phone` imports fail to resolve.
**Why it happens:** Vitest needs the same path alias config as Vite.
**How to avoid:** By configuring Vitest inline in `vite.config.js`, the `resolve.alias` config is automatically shared. No extra tsconfig-paths setup needed.

### Pitfall 4: tsconfig include Not Covering Test Files
**What goes wrong:** TypeScript IDE errors in test files because `tsconfig.json` has `"include": ["src"]` and tests are in `src/`.
**How to avoid:** Since we're co-locating tests in `src/`, this is already covered. No tsconfig change needed.

## Code Examples

### Phone Normalization Module (`src/lib/phone.ts`)

The functions to extract from `guest-excel.ts`:

```typescript
// Source: src/lib/guest-excel.ts lines 59-69 (current location)

/**
 * Normalize a raw phone string to 972-prefixed digits.
 * "050-1234567" -> "9721234567"
 * "+972-52-1234567" -> "972521234567"
 * "0521234567" -> "972521234567"
 */
export function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

/**
 * Check if a raw phone string has a plausible number of digits (9-12).
 */
export function isValidPhone(raw: string): boolean {
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 12;
}
```

### Database phone_core Equivalent (for reference in tests)

```sql
-- Source: supabase/migrations/20260317150000_sync_arrival_to_invitations.sql
-- "972522937174" -> "522937174", "0522937174" -> "522937174", "522937174" -> "522937174"
CREATE OR REPLACE FUNCTION public.phone_core(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p LIKE '972%' THEN substring(p from 4)
    WHEN p LIKE '0%'   THEN substring(p from 2)
    ELSE p
  END;
$$;
```

### Test File Structure (`src/lib/phone.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone } from './phone';

describe('normalizePhone', () => {
  // Standard Israeli mobile formats
  it('converts 05x local format', () => {
    expect(normalizePhone('0521234567')).toBe('972521234567');
  });

  it('passes through 972 prefix', () => {
    expect(normalizePhone('972521234567')).toBe('972521234567');
  });

  it('strips + from +972', () => {
    expect(normalizePhone('+972521234567')).toBe('972521234567');
  });

  it('strips dashes', () => {
    expect(normalizePhone('052-123-4567')).toBe('972521234567');
  });

  it('strips spaces', () => {
    expect(normalizePhone('052 123 4567')).toBe('972521234567');
  });

  // Edge cases
  it('handles mixed separators', () => {
    expect(normalizePhone('+972-52 123-4567')).toBe('972521234567');
  });

  it('handles raw digits without prefix', () => {
    expect(normalizePhone('521234567')).toBe('521234567');
  });
});

describe('isValidPhone', () => {
  it('accepts 10-digit local number', () => {
    expect(isValidPhone('0521234567')).toBe(true);
  });

  it('accepts 12-digit international', () => {
    expect(isValidPhone('972521234567')).toBe(true);
  });

  it('rejects too-short numbers', () => {
    expect(isValidPhone('12345')).toBe(false);
  });

  it('rejects too-long numbers', () => {
    expect(isValidPhone('1234567890123')).toBe(false);
  });
});
```

### Vitest Config Addition to vite.config.js

```javascript
/// <reference types="vitest/config" />
// Add to existing defineConfig:
test: {
  globals: true,
  environment: 'node',
  include: ['src/**/*.test.{ts,tsx}'],
  exclude: ['node_modules', 'tests'],
},
```

### package.json Script Addition

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate vitest.config.ts | Inline `test` block in vite.config.js | Vitest 1.x+ | One config file, shared aliases/plugins |
| Jest for Vite projects | Vitest | 2023+ | Native ESM, no babel, same transform pipeline as build |
| `vitest` command (global) | `vitest run` (one-shot) / `vitest` (watch) | Vitest 1.x+ | `run` for CI scripts, bare `vitest` for dev watch mode |

## Open Questions

1. **Test coverage threshold**
   - What we know: Phase only requires phone normalization tests specifically
   - What's unclear: Whether to set a coverage threshold now or defer
   - Recommendation: Skip coverage configuration for now. Phase 7 scope is narrow (phone utils only). Add coverage tooling when the test suite grows.

2. **React component testing**
   - What we know: No component tests are required in this phase
   - What's unclear: Whether future phases will need component tests (requiring jsdom/happy-dom)
   - Recommendation: Use `environment: 'node'` as default. Individual test files can override with `// @vitest-environment jsdom` comment when needed later.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Vitest configured and `npm run test` runs successfully | Vitest 4.1.0 already installed. Config goes inline in `vite.config.js`. Add `test` and `test:watch` scripts to package.json. Exclude `tests/` dir (Playwright). |
| TEST-02 | Phone normalization has comprehensive unit tests covering 05x, +972, 972, dashes, spaces, edge cases | Extract `normalizePhone` and `isValidPhone` from `guest-excel.ts` to `src/lib/phone.ts`. Co-locate tests at `src/lib/phone.test.ts`. Must cover all formats listed + parity awareness with DB `phone_core` function. |
| TEST-03 | CLAUDE.md mandates E2E (Playwright) and unit tests (Vitest) as completion requirement for all future phases | Add a section to the Development Workflow area of CLAUDE.md specifying that `npm run test` and `npm run test:e2e` must pass before any phase is marked complete. |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: `package.json` (vitest 4.1.0 in devDependencies), `vite.config.js`, `tsconfig.json`
- `src/lib/guest-excel.ts` lines 59-69: existing `normalizePhone` and `isValidPhone` functions
- `supabase/migrations/20260317150000_sync_arrival_to_invitations.sql`: `phone_core` SQL function
- `playwright.config.ts`: existing E2E test configuration
- `tests/rsvp.spec.ts`: existing Playwright test
- Vitest CLI: confirmed v4.1.0 installed and runnable

### Secondary (MEDIUM confidence)
- Vitest inline config pattern (standard since Vitest 1.x, well-documented)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest already installed, version confirmed, no new dependencies needed
- Architecture: HIGH - Co-located test pattern is standard for Vite+Vitest projects; function extraction is straightforward
- Pitfalls: HIGH - Vitest/Playwright collision is well-known; phone normalization parity verified by reading both JS and SQL implementations

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable infrastructure, unlikely to change)
