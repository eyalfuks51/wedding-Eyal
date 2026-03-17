// tests/rsvp.spec.ts
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const DUMMY_PHONE = '0509999999';
const DUMMY_NAME = 'בדיקה אוטומטית';
const TEST_EVENT_ID = 'f95c0196-1fa7-441c-bc36-c0f9e833f2e8';
const TEST_EVENT_SLUG = 'hagit-and-itai';

test.describe('RSVP Form — E2E', () => {
  test.afterAll(async () => {
    // Use service role key to bypass RLS for DELETE (anon DELETE policy not configured).
    // process.env is populated from .env.local via dotenv in playwright.config.ts.
    const url = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      console.warn(
        'Teardown skipped: VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY not set in .env.local'
      );
      return;
    }
    const supabase = createClient(url, serviceKey);
    const { error } = await supabase
      .from('arrival_permits')
      .delete()
      .eq('event_id', TEST_EVENT_ID)
      .eq('phone', DUMMY_PHONE);
    if (error) {
      console.error('Teardown failed:', error.message);
    } else {
      console.log('Teardown: dummy arrival_permit deleted');
    }
  });

  test('submits RSVP and shows success state when attending', async ({ page }) => {
    await page.goto(`/${TEST_EVENT_SLUG}`);

    // Scroll RSVP form into view before interacting.
    // The form is below the fold. GSAP ScrollTrigger uses start:'top top',
    // so it only fires once the element enters the viewport.
    // Without this scroll, form fields remain at opacity:0 and interactions fail.
    const rsvpForm = page.locator('.rsvp__form');
    await rsvpForm.scrollIntoViewIfNeeded();
    await expect(rsvpForm).toBeVisible({ timeout: 15000 });

    // Fill name and phone
    await page.fill('input[name="name"]', DUMMY_NAME);
    await page.fill('input[name="phone"]', DUMMY_PHONE);

    // Click attending — this reveals the guest_count select
    await page.click('button:has-text("בטח שאגיע!")');

    // Select guest count (select is conditionally rendered after attending click)
    await page.selectOption('select[name="guest_count"]', '1');

    // Submit
    await page.click('button[type="submit"]');

    // Assert success state
    const successTitle = page.locator('.rsvp__success-title');
    await expect(successTitle).toBeVisible({ timeout: 10000 });
    await expect(successTitle).toHaveText('תודה רבה');

    const successText = page.locator('.rsvp__success-text');
    await expect(successText).toContainText('מתרגשים לחגוג איתכם');
  });
});
