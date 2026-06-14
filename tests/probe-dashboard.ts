import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => console.log(`[console:${m.type()}]`, m.text()));
  page.on('pageerror', (e) => console.log(`[pageerror]`, e.message));
  page.on('requestfailed', (req) => console.log(`[requestfailed]`, req.url(), req.failure()?.errorText));
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('supabase') || (u.includes('localhost') && !u.includes('@'))) {
      console.log(`[response:${res.status()}]`, u.slice(0, 150));
    }
  });

  console.log('=== /dashboard (no session) ===');
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const state = await page.evaluate(() => ({
    url:           window.location.href,
    pathname:      window.location.pathname,
    bodyText:      document.body.innerText.slice(0, 300),
    rootChildren:  document.getElementById('root')?.children.length,
    rootHTML:      document.getElementById('root')?.innerHTML.slice(0, 800),
  }));
  console.log('STATE:', JSON.stringify(state, null, 2));

  await browser.close();
})();
