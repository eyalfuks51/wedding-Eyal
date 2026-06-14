import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext();
  const page    = await context.newPage();

  const errors: string[] = [];
  const logs:   string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') errors.push(`[console.error] ${text}`);
  });
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));

  // ── Step 1: Go to login page ──
  console.log('Opening login page…');
  await page.goto('http://localhost:5173/login');

  // ── Step 2: Click "Continue with Google" ──
  await page.waitForSelector('button', { timeout: 10_000 });
  const googleBtn = page.locator('button').filter({ hasText: /google/i }).first();
  if (await googleBtn.isVisible()) {
    console.log('Clicking Google sign-in…');
    await googleBtn.click();
  } else {
    console.log('Google button not found. Already on:', page.url());
  }

  // ── Step 3: Wait for OAuth redirect back to /dashboard (user logs in manually) ──
  console.log('Waiting for you to complete Google login (up to 120 s)…');
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 120_000 });
    console.log('Logged in! Now at:', page.url());
  } catch {
    console.log('Timed out waiting for login. Current URL:', page.url());
    await browser.close();
    return;
  }

  // ── Step 4: Navigate to timeline and capture errors ──
  errors.length = 0;
  logs.length   = 0;

  console.log('Navigating to /dashboard/timeline…');
  await page.goto('http://localhost:5173/dashboard/timeline');
  await page.waitForTimeout(5000);

  const finalUrl  = page.url();
  const title     = await page.title();
  const bodyText  = await page.locator('body').innerText().catch(() => '(failed)');
  const bodyHtml  = await page.locator('body').innerHTML().catch(() => '(failed)');

  console.log('\n=== RESULTS ===');
  console.log('Final URL:', finalUrl);
  console.log('Title:',     title);
  console.log('Body text (first 500):', bodyText.slice(0, 500));
  console.log('Body HTML (first 800):', bodyHtml.slice(0, 800));
  console.log('\nAll console logs:');
  logs.forEach(l => console.log(' ', l));
  console.log('\nErrors:', errors.length ? errors.join('\n') : 'none');

  await page.screenshot({ path: 'tests/debug-screenshot.png', fullPage: true });
  console.log('\nScreenshot saved to tests/debug-screenshot.png');

  await browser.close();
})();
