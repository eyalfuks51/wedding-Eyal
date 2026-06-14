import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => console.log(`[console:${m.type()}]`, m.text()));
  page.on('pageerror', (e) => console.log(`[pageerror]`, e.message));

  // Land on /login first (same origin localhost:5173) so iframe shares origin
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Have the parent grab the auth lock, then inject iframe
  await page.evaluate(() => {
    (window as any).__lockAcquired = false;
    if (navigator.locks) {
      navigator.locks.request('lock:sb-wpxaalcjcsmhdwvwmtan-auth-token', { mode: 'exclusive' }, async () => {
        (window as any).__lockAcquired = true;
        console.log('[parent] holding auth lock 4s');
        await new Promise(r => setTimeout(r, 4000));
        console.log('[parent] releasing auth lock');
      });
    }

    const iframe = document.createElement('iframe');
    iframe.src = '/preview/hagit-and-itai';
    iframe.width = '375';
    iframe.height = '600';
    iframe.id = 'lp';
    document.body.appendChild(iframe);
  });

  console.log('=== waiting 7s for iframe + lock release ===');
  await page.waitForTimeout(7000);

  const iframeText = await page
    .frameLocator('#lp')
    .locator('body')
    .first()
    .innerText()
    .catch((e) => `<err: ${e.message}>`);
  console.log('Iframe body text:', iframeText?.slice(0, 300));

  await browser.close();
})();
