/**
 * Reproduce blank-on-reload at /dashboard while authenticated.
 * Run: npx tsx tests/probe-authed-dashboard-reload.ts
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, '.auth-profile');

async function snapshot(page, label) {
  await page.screenshot({ path: path.resolve(__dirname, `dash-reload-${label}.png`), fullPage: true });
  return await page.evaluate(() => ({
    url:           location.href,
    pathname:      location.pathname,
    bodyText:      document.body.innerText.slice(0, 400),
    rootChildren:  document.getElementById('root')?.children.length ?? 0,
    rootTag:       document.getElementById('root')?.firstElementChild?.tagName ?? null,
    rootSnippet:   document.getElementById('root')?.innerHTML.slice(0, 600) ?? null,
    title:         document.title,
    lsKeys:        Object.keys(localStorage),
  }));
}

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on('console',       (m) => console.log(`[console:${m.type()}]`, m.text()));
  page.on('pageerror',     (e) => console.log(`[pageerror]`, e.message, '\n', e.stack));
  page.on('requestfailed', (req) => console.log(`[requestfailed]`, req.url(), req.failure()?.errorText));
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('supabase')) console.log(`[response:${res.status()}]`, u.slice(0, 200));
  });

  console.log('=== STEP 1: navigate /dashboard ===');
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const before = await snapshot(page, 'before');
  console.log('BEFORE:', JSON.stringify(before, null, 2));

  console.log('\n=== STEP 2: page.reload() ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const after = await snapshot(page, 'after');
  console.log('AFTER:', JSON.stringify(after, null, 2));

  console.log('\n=== STEP 3: page.reload() AGAIN ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const after2 = await snapshot(page, 'after2');
  console.log('AFTER2:', JSON.stringify(after2, null, 2));

  console.log('\n=== DIFF ===');
  console.log('rootChildren:', before.rootChildren, '→', after.rootChildren, '→', after2.rootChildren);
  console.log('rootTag:     ', before.rootTag,      '→', after.rootTag,      '→', after2.rootTag);
  console.log('bodyText len:', before.bodyText.length, '→', after.bodyText.length, '→', after2.bodyText.length);

  await ctx.close();
})();
