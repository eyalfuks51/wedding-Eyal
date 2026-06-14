/**
 * One-time auth setup. Run with: npx tsx tests/auth-setup.ts
 * Opens a HEADED browser with a persistent profile at tests/.auth-profile/.
 * You log in via Google OAuth (including device approval if needed) inside that browser.
 * Profile is saved on disk; subsequent probes reuse it without re-auth.
 *
 * Closes when you reach /dashboard (or after 5 min timeout).
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, '.auth-profile');

(async () => {
  console.log('Profile dir:', PROFILE_DIR);
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('http://localhost:5173/login');

  console.log('Log in via Google in the opened browser. Closes after session is persisted.');
  try {
    await page.waitForURL((u) => u.pathname.startsWith('/dashboard'), { timeout: 5 * 60 * 1000 });
    console.log('Reached /dashboard. Waiting for Supabase session to land in localStorage...');

    // Wait until Supabase has written the session to localStorage.
    await page.waitForFunction(
      () => Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token')),
      { timeout: 30_000 }
    );
    // Extra grace period for any subsequent writes (refresh token, etc.)
    await page.waitForTimeout(2000);

    const lsKeys = await page.evaluate(() => Object.keys(localStorage));
    console.log('localStorage keys:', lsKeys);
    console.log('Session persisted. Profile saved.');
  } catch (e) {
    console.log('Setup did not complete cleanly:', (e as Error).message);
    const lsKeys = await page.evaluate(() => Object.keys(localStorage)).catch(() => []);
    console.log('localStorage keys at exit:', lsKeys);
  }

  await ctx.close();
})();
