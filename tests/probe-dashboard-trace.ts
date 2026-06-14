/**
 * Trace what blocks the dashboard's spinner.
 * Pure-JS init script (no TS transpile artifacts that pollute the page).
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.resolve(__dirname, '.auth-profile');

const INIT_SCRIPT = `
(function () {
  var origRequest = navigator.locks.request.bind(navigator.locks);
  var lockId = 0;
  navigator.locks.request = function (name, optsOrCb, maybeCb) {
    var id = ++lockId;
    var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
    var opts = typeof optsOrCb === 'function' ? {} : optsOrCb;
    console.log('[lock#' + id + '] REQUEST ' + name + ' mode=' + (opts && opts.mode || 'exclusive'));
    var wrappedCb = function (lock) {
      var t0 = performance.now();
      console.log('[lock#' + id + '] ACQUIRED lock=' + (lock ? 'granted' : 'NULL'));
      try {
        var result = cb(lock);
        Promise.resolve(result).then(
          function () { console.log('[lock#' + id + '] CB_DONE in ' + Math.round(performance.now() - t0) + 'ms'); },
          function (e) { console.log('[lock#' + id + '] CB_THREW: ' + (e && e.message)); }
        );
        return result;
      } catch (e) {
        console.log('[lock#' + id + '] CB_SYNC_THREW: ' + (e && e.message));
        throw e;
      }
    };
    var p = typeof optsOrCb === 'function'
      ? origRequest(name, wrappedCb)
      : origRequest(name, opts, wrappedCb);
    p.then(
      function () { console.log('[lock#' + id + '] PROMISE_RESOLVED'); },
      function (e) { console.log('[lock#' + id + '] PROMISE_REJECTED: ' + (e && e.message)); }
    );
    return p;
  };

  // Track localStorage reads for sb-* keys
  var origGetItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) {
    var v = origGetItem.call(this, k);
    if (typeof k === 'string' && k.indexOf('sb-') === 0) {
      console.log('[ls.get] ' + k + ' -> ' + (v ? 'present(' + v.length + ')' : 'null'));
    }
    return v;
  };
  var origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (typeof k === 'string' && k.indexOf('sb-') === 0) {
      console.log('[ls.set] ' + k + ' length=' + (v ? v.length : 0));
    }
    return origSetItem.call(this, k, v);
  };
  var origRemoveItem = Storage.prototype.removeItem;
  Storage.prototype.removeItem = function (k) {
    if (typeof k === 'string' && k.indexOf('sb-') === 0) {
      console.log('[ls.del] ' + k);
    }
    return origRemoveItem.call(this, k);
  };

  // Track fetch
  var fetchId = 0;
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var id = ++fetchId;
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    console.log('[fetch#' + id + '] START ' + (init && init.method || 'GET') + ' ' + url.slice(0, 150));
    var t0 = performance.now();
    var p = origFetch.apply(this, arguments);
    p.then(
      function (r) { console.log('[fetch#' + id + '] DONE ' + r.status + ' in ' + Math.round(performance.now() - t0) + 'ms'); },
      function (e) { console.log('[fetch#' + id + '] FAIL: ' + (e && e.message)); }
    );
    return p;
  };

  window.__queryLocks = function () {
    return navigator.locks.query().then(function (q) {
      console.log('[locks.query] held=' + JSON.stringify(q.held) + ' pending=' + JSON.stringify(q.pending));
    });
  };
})();
`;

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.addInitScript({ content: INIT_SCRIPT });

  page.on('console',       (m) => console.log(`[console:${m.type()}]`, m.text()));
  page.on('pageerror',     (e) => console.log(`[pageerror]`, e.message));
  page.on('requestfailed', (req) => console.log(`[requestfailed]`, req.url(), req.failure()?.errorText));
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('supabase')) console.log(`[response:${res.status()}]`, u.slice(0, 200));
  });

  console.log('=== navigate /dashboard ===');
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' });

  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(2000);
    console.log(`\n--- t=${(i + 1) * 2}s ---`);
    await page.evaluate(() => (window as any).__queryLocks()).catch(() => {});
    const root = await page.evaluate(() => ({
      bodyLen: document.body.innerText.length,
      rootSnippet: document.getElementById('root')?.firstElementChild?.outerHTML.slice(0, 200) ?? '',
    }));
    console.log('root:', root);
  }

  await ctx.close();
})();
