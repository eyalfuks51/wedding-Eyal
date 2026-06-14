import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => console.log(`  [console:${m.type()}]`, m.text()));
  page.on('pageerror', (e) => console.log(`  [pageerror]`, e.message));
  page.on('requestfailed', (req) => console.log(`  [requestfailed]`, req.url(), req.failure()?.errorText));
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('supabase') || u.includes('localhost')) {
      console.log(`  [response:${res.status()}]`, u);
    }
  });

  console.log('=== LOCAL ===');
  await page.goto('http://localhost:5173/hagit-and-itai', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const localState = await page.evaluate(() => ({
    bodyText: document.body.innerText.slice(0, 200),
    rootChildren: document.getElementById('root')?.children.length,
    rootHTML: document.getElementById('root')?.innerHTML.slice(0, 500),
  }));
  console.log('LOCAL DOM:', JSON.stringify(localState, null, 2));

  console.log('\n=== VERCEL ===');
  await page.goto('https://magic-moments-rsvp.vercel.app/hagit-and-itai', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const vercelState = await page.evaluate(() => ({
    bodyText: document.body.innerText.slice(0, 200),
    rootChildren: document.getElementById('root')?.children.length,
  }));
  console.log('VERCEL DOM:', JSON.stringify(vercelState, null, 2));

  await browser.close();
})();
