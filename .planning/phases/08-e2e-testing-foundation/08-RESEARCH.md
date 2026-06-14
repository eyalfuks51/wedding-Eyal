# Phase 8: E2E Testing Foundation - Research

**Researched:** 2026-03-17
**Domain:** Playwright E2E testing, Supabase teardown, RSVP form integration
**Confidence:** HIGH

## Summary

Phase 8 completes the E2E testing layer that Phase 7 deferred. The goal is a single, self-contained Playwright test that navigates to the RSVP form for a dedicated test event (`event_id: f95c0196-1fa7-441c-bc36-c0f9e833f2e8`), submits dummy data, asserts the success state, and then performs a teardown that deletes the dummy `arrival_permits` row so no test pollution accumulates.

The existing `tests/rsvp.spec.ts` is a working skeleton that already targets the correct form selectors (`.rsvp__form`, `input[name="name"]`, `input[name="phone"]`, `.rsvp__success-title`). However it targets the live event `hagit-and-itai`, not the dedicated test event, and it has no teardown. Both gaps need to be closed.

The key problem for teardown is that `supabase.js` uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — environment variables accessed via `import.meta.env`. Playwright runs in Node.js, not in a Vite build, so `import.meta.env` is not available. The teardown must use a Node.js-compatible Supabase client initialized directly from `process.env` (dotenv) or from values loaded from `.env.local`.

**Primary recommendation:** Update `tests/rsvp.spec.ts` to target the dedicated test event slug, add `globalSetup`/`afterAll` teardown using a Node.js Supabase client (initialized with `process.env` not `import.meta.env`), and load `.env.local` via `dotenv` in the Playwright global setup or directly in the test file.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | 1.58.2 | E2E browser automation | Already installed and configured; `playwright.config.ts` exists |
| @supabase/supabase-js | 2.94.0 | Database teardown client | Already installed; use in Node.js context for cleanup |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | built-in via Node | Load `.env.local` in Node.js test context | Needed because `import.meta.env` does not work outside Vite |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dotenv` to load .env.local | Hard-code dummy env values in playwright.config.ts `env` block | `playwright.config.ts` can set `process.env` via `use.env` — avoids dotenv dependency entirely; safer pattern |
| Direct `.delete()` teardown | Supabase service role key | Anon client already has RLS `allow anon DELETE` — service role not needed for this table |

**Installation:**

No new packages needed. `@playwright/test` and `@supabase/supabase-js` are already installed.

Confirm `dotenv` availability:
```bash
node -e "require('dotenv')" && echo "dotenv available" || npm install --save-dev dotenv
```

Note: dotenv is typically a transitive dependency already present. If not, add it.

## Architecture Patterns

### Recommended Test Structure
```
tests/
  rsvp.spec.ts          # Updated: targets test event + includes teardown
playwright.config.ts    # Updated: loads env vars for Supabase, configures webServer
```

### Pattern 1: Teardown via `afterAll` in the same test file
**What:** Use Playwright's `test.afterAll` hook to delete the dummy `arrival_permits` row after all tests in the describe block complete, whether they pass or fail.
**When to use:** When there is one test file with one submission — keep teardown close to the test that creates the data.
**Example:**
```typescript
// Source: Playwright docs + @supabase/supabase-js Node.js usage
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const DUMMY_PHONE = '0509999999';
const TEST_EVENT_ID = 'f95c0196-1fa7-441c-bc36-c0f9e833f2e8';

test.describe('RSVP Form - Test Event', () => {
  test.afterAll(async () => {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );
    await supabase
      .from('arrival_permits')
      .delete()
      .eq('event_id', TEST_EVENT_ID)
      .eq('phone', DUMMY_PHONE);
  });

  test('should submit RSVP successfully when attending', async ({ page }) => {
    // test body
  });
});
```

### Pattern 2: Environment variables for Node.js context
**What:** Playwright tests run in Node.js, not in a Vite context. `import.meta.env` does not exist. Pass env vars to the Node.js test process via `playwright.config.ts`.
**When to use:** Always — mandatory for this phase.
**Two approaches (both valid):**

Approach A — dotenv in playwright.config.ts:
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({ /* ... */ });
```

Approach B — Playwright's built-in `env` option (no dotenv needed):
```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    baseURL: 'http://localhost:5173',
  },
  // Playwright passes these to process.env in every test worker
  // Values come from the existing process.env (set by CI or shell)
  // For local dev, set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in shell before running
});
```

**Recommended approach for this project:** Use dotenv to load `.env.local` at the top of `playwright.config.ts`. This matches how Vite loads env vars for the dev server (`.env.local`) and requires no extra shell configuration.

### Pattern 3: Dedicated dummy phone number
**What:** Use a specific dummy phone number that is unique to test runs (e.g., `0509999999`). The teardown deletes by `event_id + phone`, making it idempotent.
**Why:** The `arrival_permits` table has a unique constraint `arrival_permits_event_phone_unique` on `(event_id, phone)`. The `submitRsvp` function uses `upsert` with `onConflict: 'event_id,phone'`, so re-running the test overwrites rather than creating duplicates. The teardown deletes that one specific row.

### Anti-Patterns to Avoid
- **Using the live `hagit-and-itai` event for E2E tests:** Would pollute real event data with test RSVPs. Always use the dedicated test event.
- **Calling `supabase.js` functions from tests directly:** Those functions use `import.meta.env` which is Vite-specific and unavailable in Node.js. Initialize a fresh Supabase client in the test file using `process.env`.
- **Skipping teardown when test passes:** Always run teardown in `afterAll` regardless of test outcome. Playwright's `afterAll` runs even if tests fail.
- **Using a service role key for teardown:** The `arrival_permits` table already has `Allow anon DELETE` RLS (or anon UPDATE/SELECT/INSERT). The anon key is sufficient for the teardown DELETE.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom Puppeteer scripts | `@playwright/test` (already configured) | Auto-wait, retries, multi-browser support |
| Database teardown | SQL migrations | Supabase client `.delete()` in `afterAll` | Direct, targeted, uses existing auth |
| Env loading in Node | Manual `fs.readFileSync('.env.local')` | `dotenv` | Standard, handles quoting, comments, and edge cases |

## Common Pitfalls

### Pitfall 1: `import.meta.env` in Node.js Playwright context
**What goes wrong:** Importing or calling `src/lib/supabase.js` directly from a test file causes `import.meta.env` to be `undefined`, making the Supabase client `null`.
**Why it happens:** Playwright test files are compiled/run by Node.js (via `@playwright/test` runner), not through the Vite dev server. `import.meta.env` is a Vite-specific transform.
**How to avoid:** In test files, initialize Supabase directly: `createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)`. Never import from `src/lib/supabase.js` in test files.
**Warning signs:** `TypeError: Cannot read properties of null (reading 'from')` or similar null-dereference on the Supabase client.

### Pitfall 2: GSAP ScrollTrigger blocking form visibility
**What goes wrong:** The RSVP form has GSAP scroll-trigger animations — elements start at `opacity: 0, y: 20`. In a headless browser, the scroll trigger may not fire, leaving form fields invisible and non-interactive.
**Why it happens:** GSAP ScrollTrigger listens for scroll events. Headless Playwright doesn't auto-scroll. However, looking at the animation config, it uses `start: 'top top'` which fires immediately when the element enters the viewport — in a standard viewport (1280x720), the RSVP section below the fold won't auto-scroll into view.
**How to avoid:** Before interacting with the form, scroll the form into view explicitly: `await page.locator('.rsvp__form').scrollIntoViewIfNeeded()`. Then wait for visibility with a timeout.
**Warning signs:** `locator.fill()` times out or `toBeVisible` assertion fails despite the page loading successfully.

### Pitfall 3: Test event slug unknown — must be discovered
**What goes wrong:** The test event ID `f95c0196-1fa7-441c-bc36-c0f9e833f2e8` is provided, but its `slug` (which determines the URL path) is not documented anywhere in the codebase.
**Why it happens:** The event slug is stored only in the Supabase database.
**How to avoid:** The planner must account for a task that: (1) queries the `events` table for `slug WHERE id = 'f95c0196-1fa7-441c-bc36-c0f9e833f2e8'`, OR (2) creates the test event in the database if it doesn't exist. The existing `rsvp.spec.ts` uses `hagit-and-itai` as the slug — this is the likely test event slug, but it must be confirmed. Alternatively, if the test event slug is different, it needs to be seeded.
**Warning signs:** Playwright navigates to a URL that returns NotFoundPage.

### Pitfall 4: Unique constraint collision on repeated test runs
**What goes wrong:** Running the test twice without teardown (or after a failed teardown) causes the RSVP upsert to update an existing row — this is actually safe because `submitRsvp` uses `upsert` with `onConflict`. The success state still shows.
**Why it happens:** Not actually a failure case — the upsert semantics handle it gracefully.
**How to handle:** Teardown still matters to keep the database clean. The test will pass on re-runs even without teardown, but policy requires clean state.

### Pitfall 5: `rsvp__form` not visible without scrolling
**What goes wrong:** The existing `rsvp.spec.ts` does `await expect(rsvpSection).toBeVisible({ timeout: 15000 })` but the form is below the fold. Playwright's `toBeVisible` passes if the element is in the DOM and not `display:none`, even if offscreen.
**Clarification:** `toBeVisible` in Playwright does NOT require the element to be in the viewport — it checks CSS visibility, not viewport intersection. So the existing test pattern works. However, `fill()` and `click()` may auto-scroll if needed.

## Code Examples

### Complete Updated Test File
```typescript
// tests/rsvp.spec.ts
// Source: Based on existing skeleton + Playwright afterAll teardown pattern
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const DUMMY_PHONE = '0509999999';
const DUMMY_NAME = 'בדיקה אוטומטית';
const TEST_EVENT_ID = 'f95c0196-1fa7-441c-bc36-c0f9e833f2e8';
const TEST_EVENT_SLUG = 'hagit-and-itai'; // confirm this matches the test event_id in DB

test.describe('RSVP Form - E2E', () => {
  test.afterAll(async () => {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase
      .from('arrival_permits')
      .delete()
      .eq('event_id', TEST_EVENT_ID)
      .eq('phone', DUMMY_PHONE.replace(/\D/g, '')); // RsvpForm strips non-digits before upsert
    if (error) console.error('Teardown failed:', error.message);
  });

  test('submits RSVP and shows success state', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}`);

    // Scroll RSVP form into view to trigger GSAP ScrollTrigger
    const rsvpForm = page.locator('.rsvp__form');
    await rsvpForm.scrollIntoViewIfNeeded();
    await expect(rsvpForm).toBeVisible({ timeout: 15000 });

    await page.fill('input[name="name"]', DUMMY_NAME);
    await page.fill('input[name="phone"]', DUMMY_PHONE);
    await page.click('button:has-text("בטח שאגיע!")');
    await page.selectOption('select[name="guest_count"]', '1');
    await page.click('button[type="submit"]');

    const successTitle = page.locator('.rsvp__success-title');
    await expect(successTitle).toBeVisible({ timeout: 10000 });
    await expect(successTitle).toHaveText('תודה רבה');
  });
});
```

### playwright.config.ts — Add dotenv loading
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// so Supabase client in afterAll teardown has access via process.env
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Phone normalization — what arrives in the DB
```typescript
// RsvpForm.jsx line 93: const cleanPhone = formData.phone.trim().replace(/\D/g, '');
// submitRsvp stores: phone: rsvpData.phone.trim().replace(/\D/g, '')
// So '0509999999' stored as '0509999999' (10 digits, no prefix change at insert time)
// Teardown must delete by '0509999999', not '9720509999999'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest + Puppeteer | Playwright | 2021+ | Single API for navigation, assertions, multi-browser |
| `afterEach` teardown | `afterAll` teardown | N/A | One DB call per test suite, not per test case |
| Service role key for cleanup | Anon key (RLS allows DELETE) | Per project | Avoids secret sprawl in test config |

## Open Questions

1. **Does `f95c0196-1fa7-441c-bc36-c0f9e833f2e8` correspond to `hagit-and-itai` slug?**
   - What we know: The existing `rsvp.spec.ts` tests `hagit-and-itai`. The phase brief specifies event_id `f95c0196-1fa7-441c-bc36-c0f9e833f2e8`.
   - What's unclear: Whether they are the same event or different events.
   - Recommendation: The planner must include a step to verify the slug for the given UUID (query the database, or check Supabase dashboard). If they match: just update teardown. If different: update the slug in the test.

2. **Does the `arrival_permits` RLS allow anon DELETE?**
   - What we know: CLAUDE.md documents `Allow anon INSERT`, `Allow anon UPDATE`, `Allow anon SELECT` for `arrival_permits`. DELETE is not listed.
   - What's unclear: Whether a DELETE policy exists or is needed.
   - Recommendation: The planner must include a task to add `Allow anon DELETE` RLS policy to `arrival_permits` (scoped to `event_id = 'f95c0196...'` for safety), OR use the Supabase service role key in the test teardown. Using service role is cleaner for teardown since it bypasses RLS entirely. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and `.env.example` for the teardown client only.

3. **`dotenv` package availability**
   - What we know: Not listed in `package.json` devDependencies.
   - What's unclear: Whether it's available as a transitive dep.
   - Recommendation: Explicitly install `dotenv` as a devDependency to avoid relying on transitive availability.

## Validation Architecture

> nyquist_validation is not set in config.json (only `research`, `plan_check`, `verifier` are set) — skip this section.

## Sources

### Primary (HIGH confidence)
- `tests/rsvp.spec.ts` — existing Playwright test skeleton with correct selectors
- `playwright.config.ts` — existing config: `testDir: './tests'`, `baseURL: 'http://localhost:5173'`, webServer command
- `src/components/RsvpForm/RsvpForm.jsx` — form field names, submit behavior, success CSS classes, phone stripping logic
- `src/lib/supabase.js` — `submitRsvp` upsert implementation, `onConflict: 'event_id,phone'`
- `package.json` — `@playwright/test: ^1.58.2`, `@supabase/supabase-js: ^2.94.0` already installed
- `CLAUDE.md` — `arrival_permits` RLS policies (INSERT/UPDATE/SELECT documented, DELETE not documented)
- `.env.example` — confirms env var names: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Secondary (MEDIUM confidence)
- Playwright `afterAll` teardown pattern — standard Playwright API, no verification needed
- `import.meta.env` vs `process.env` in Playwright Node.js context — well-established Vite/Playwright distinction

### Tertiary (LOW confidence)
- GSAP ScrollTrigger behavior in headless Playwright — warrants a scroll-into-view guard in the test as preventive measure

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-01 | Playwright test navigates to RSVP form for test event, fills dummy data, submits, and asserts success | Update `tests/rsvp.spec.ts`: use test event slug (confirm from DB), use unique dummy phone `0509999999`, scroll form into view to handle GSAP, assert `.rsvp__success-title` contains 'תודה רבה'. Load `.env.local` via dotenv in `playwright.config.ts`. |
| E2E-02 | Test teardown deletes dummy submission from `arrival_permits` via Supabase client, leaving database clean | Add `test.afterAll` in `tests/rsvp.spec.ts` using `createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY)`. Delete by `event_id + phone`. Requires either an anon DELETE RLS policy on `arrival_permits` OR a service role key for the teardown client. Investigate which is available/preferred. |
</phase_requirements>

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions confirmed from package.json
- Architecture: HIGH — Playwright afterAll pattern is standard; import.meta.env vs process.env distinction is verified
- Pitfalls: HIGH — GSAP scroll pitfall identified from code analysis; RLS DELETE gap identified from CLAUDE.md
- Open questions: MEDIUM — slug-to-UUID mapping and DELETE RLS existence require a DB lookup to confirm

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable infrastructure)
