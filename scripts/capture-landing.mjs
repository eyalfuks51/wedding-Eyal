// Landing-page capture for OBS demos. Drives headed Chromium, grabs stills,
// then does an eased marketing scroll on ENTER while YOU record in OBS.
// This is a demo capture tool, NOT a test. Does not control OBS.
//
//   node scripts/capture-landing.mjs --device desktop
//   node scripts/capture-landing.mjs --device mobile
//   node scripts/capture-landing.mjs --device desktop --screenshots-only
//
// BASE_URL env (default http://localhost:3007), route "/".
// Run the marketing app on that port first: `next dev -p 3007` (apps/marketing).
//
// Clean-recording strategy (so OBS captures only page content, no browser UI):
//   - OBS desktop run -> window opened fullscreen (no tabs/address/bookmarks).
//   - OBS mobile run  -> chromeless --app window sized to the phone frame.
//   - scrollbars killed via --hide-scrollbars launch flag + injected CSS.
//   - automation infobar removed via ignoreDefaultArgs.
// Screenshots-only runs use exact framed viewports (1440x1000 / iPhone 13)
// since stills capture only the page, never the surrounding chrome.

import { chromium, devices } from '@playwright/test';
import readline from 'node:readline';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3007';

const args = process.argv.slice(2);
const device = args.includes('--device') ? args[args.indexOf('--device') + 1] : 'desktop';
const screenshotsOnly = args.includes('--screenshots-only');

if (device !== 'desktop' && device !== 'mobile') {
  console.error(`Unknown --device "${device}". Use desktop or mobile.`);
  process.exit(1);
}

const LABEL = device === 'desktop' ? 'Desktop' : 'Mobile';
const TARGET = `${BASE_URL}/`;
const MOBILE = { width: 390, height: 844 };

// Scroll feel — tune without editing code:  SCROLL_SPEED=620 npm run capture:mobile
const SCROLL_SPEED = Number(process.env.SCROLL_SPEED) || 520;    // px/sec, constant cruise velocity
const RAMP_MS = Number(process.env.RAMP_MS) || 550;             // ease-in/out time at each glide's ends
const TPL_DWELL_MS = Number(process.env.TPL_DWELL_MS) || 1200;  // pause on templates before switching
const LONG_DWELL_MS = Number(process.env.LONG_DWELL_MS) || 2600; // pause on testimonials
const SWITCH_MS = Number(process.env.SWITCH_MS) || 1900;        // dwell after each template switch
const END_SPEED = Number(process.env.END_SPEED) || 260;         // px/sec for the final descent to bottom (slower)

// Optional file-driven gate (lets an orchestrator drive the run instead of ENTER):
// scroll starts when TRIGGER_FILE appears, window closes when it's removed.
const TRIGGER_FILE = process.env.TRIGGER_FILE;

const outDir = path.join(ROOT, 'captures', 'landing', device, 'screenshots');
mkdirSync(outDir, { recursive: true });

// Hide scrollbars at the page level (belt-and-suspenders with --hide-scrollbars).
// Injected per Playwright session only — the app's CSS files are never touched.
const CLEAN_CSS = `
html, body {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
html::-webkit-scrollbar,
body::-webkit-scrollbar,
*::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
`;

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, () => { rl.close(); resolve(); }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitUntil = async (cond) => { while (!cond()) await sleep(400); };

// Launch a controllable single window. launchPersistentContext owns one real
// window, so --start-fullscreen / --app reliably apply to the page we drive.
async function launchForRun() {
  const baseArgs = ['--hide-scrollbars'];
  const ignoreDefaultArgs = ['--enable-automation']; // drop the automation infobar

  if (screenshotsOnly) {
    // Exact framed viewport; window chrome is irrelevant for stills.
    const browser = await chromium.launch({ headless: false, ignoreDefaultArgs, args: baseArgs });
    const context = await browser.newContext(
      device === 'desktop'
        ? { viewport: { width: 1440, height: 1000 } }
        : { ...devices['iPhone 13'] }
    );
    const page = await context.newPage();
    return { page, cleanup: () => browser.close() };
  }

  // OBS runs: chrome-free window.
  let contextOpts;
  let extraArgs;
  if (device === 'desktop') {
    extraArgs = ['--start-fullscreen'];
    contextOpts = { viewport: null }; // null -> page fills the fullscreen window, no margins
  } else {
    extraArgs = [
      `--app=${TARGET}`,
      `--window-size=${MOBILE.width},${MOBILE.height}`,
      `--force-device-scale-factor=1`, // physical px == logical px; no DPI surprises in OBS
    ];
    // window-size defines the frame. viewport:null forbids every emulation hint
    // (isMobile/hasTouch/deviceScaleFactor) — only userAgent is allowed. The
    // 390px-wide window already trips the site's mobile CSS breakpoints.
    contextOpts = { userAgent: devices['iPhone 13'].userAgent, viewport: null };
  }

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    ignoreDefaultArgs,
    args: [...baseArgs, ...extraArgs],
    ...contextOpts,
  });
  const page = context.pages()[0] || (await context.waitForEvent('page'));
  return { page, cleanup: () => context.close() };
}

async function injectCleanCss(page) {
  await page.addStyleTag({ content: CLEAN_CSS });
}

// Wait for the page, fonts, and in-view images. Deliberately NOT networkidle
// (Next dev's HMR websocket never goes idle). Each wait is time-bounded so a
// below-fold lazy <img> — whose load event won't fire until scrolled into view —
// can't hang the whole capture forever.
async function waitForReady(page) {
  await page.evaluate(async () => {
    const withTimeout = (p, ms) =>
      Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
    await withTimeout(document.fonts.ready, 4000);
    const imgs = Array.from(document.images);
    const loaded = Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.addEventListener('load', res, { once: true });
              img.addEventListener('error', res, { once: true });
            })
      )
    );
    await withTimeout(loaded, 4000);
  });
  await sleep(600); // let layout/entrance animations settle
}

// Four stills at top / middle / lower / bottom.
async function screenshots(page) {
  const total = await page.evaluate(() => document.body.scrollHeight);
  const view = await page.evaluate(() => window.innerHeight);
  const points = {
    top: 0,
    middle: Math.max(0, (total - view) * 0.4),
    lower: Math.max(0, (total - view) * 0.75),
    bottom: Math.max(0, total - view),
  };
  for (const [name, y] of Object.entries(points)) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await sleep(600);
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    console.log(`  saved ${name}.png`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
}

// Smooth, constant-velocity glide top->bottom. Duration scales with distance
// (so near and far stretches move at the SAME speed — no fast jumps), gentle
// sine ease in/out of each pause. Only stops at the two marquee sections
// (templates carousel + testimonials); everything else streams past in frame.
async function smoothScroll(page) {
  await page.evaluate(({ speed, endSpeed, rampMs, tplDwellMs, longDwellMs, switchMs }) => {
    // Trapezoidal velocity: ease-in for `r`, cruise at constant speed, ease-out.
    // Ramp is a fixed TIME, so a long glide is almost all constant-speed cruise
    // (no mid-glide "speed of light" burst); short glides stay gently eased.
    const profile = (t, r) => {
      if (r <= 0) return t;
      const vmax = 1 / (1 - r);
      if (t < r) return (vmax * t * t) / (2 * r);
      if (t <= 1 - r) return vmax * (r / 2 + (t - r));
      const u = 1 - t;
      return 1 - (vmax * u * u) / (2 * r);
    };

    const animateTo = (target, duration) =>
      new Promise((resolve) => {
        const start = window.scrollY;
        const dist = target - start;
        if (Math.abs(dist) < 2 || duration <= 0) {
          window.scrollTo(0, target);
          return resolve();
        }
        const r = Math.min(0.5, rampMs / duration);
        let startTime = null;
        const step = (now) => {
          if (startTime === null) startTime = now;
          const p = Math.min((now - startTime) / duration, 1);
          window.scrollTo(0, start + dist * profile(p, r));
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // Constant velocity: duration proportional to distance (min 450ms so a tiny
    // hop still eases instead of snapping).
    const glideAt = (y, spd) =>
      animateTo(y, Math.max(450, (Math.abs(y - window.scrollY) / spd) * 1000));
    const glideTo = (y) => glideAt(y, speed);

    window.__obsScroll = async () => {
      const view = window.innerHeight;
      const maxY = document.documentElement.scrollHeight - view;
      const margin = Math.round(view * 0.06); // small top gap so headings aren't edge-flush
      const sections = Array.from(document.querySelectorAll('section'));
      const yOf = (el) =>
        Math.max(0, Math.min(el.getBoundingClientRect().top + window.scrollY - margin, maxY));
      const templatesEl = sections.find((el) => el.querySelector('#templates-title'));
      const loveEl = sections.find((el) => el.querySelector('#love-title'));

      await wait(700); // settle on the hero

      // 1) glide to templates, dwell, switch through two templates (pause each)
      if (templatesEl) {
        await glideTo(yOf(templatesEl));
        await wait(tplDwellMs);
        const nextBtn = document.querySelector('.fc-btn--next');
        if (nextBtn) {
          nextBtn.click(); await wait(switchMs);
          nextBtn.click(); await wait(switchMs);
        }
      }
      // 2) glide to testimonials, dwell
      if (loveEl) {
        await glideTo(yOf(loveEl));
        await wait(longDwellMs);
      }
      // 3) glide to the bottom (final CTA fully in frame) — slower, calm finish
      await glideAt(maxY, endSpeed);
      await wait(800);
    };
  }, { speed: SCROLL_SPEED, endSpeed: END_SPEED, rampMs: RAMP_MS, tplDwellMs: TPL_DWELL_MS, longDwellMs: LONG_DWELL_MS, switchMs: SWITCH_MS });
  await page.evaluate(() => window.__obsScroll());
}

(async () => {
  const { page, cleanup } = await launchForRun();

  console.log(`Opening ${TARGET} (${LABEL})...`);
  await page.goto(TARGET, { waitUntil: 'load' });
  await injectCleanCss(page);
  await waitForReady(page);

  // Stills-only mode (you trigger this separately). OBS scroll runs do NOT
  // screenshot — they just present a clean window and scroll.
  if (screenshotsOnly) {
    console.log('Taking screenshots...');
    await screenshots(page);
    console.log(`${LABEL} screenshots done -> ${outDir}`);
    await cleanup();
    return;
  }

  if (device === 'mobile') {
    const OBS_TITLE = 'OBS_MOBILE_CAPTURE_GUESTO_DO_NOT_SELECT_OTHER_WINDOWS';
    await page.evaluate((t) => { document.title = t; }, OBS_TITLE);

    // Preflight screenshot so you can confirm the viewport before recording.
    const preflightPath = path.join(ROOT, 'captures', 'landing', 'mobile', 'screenshots', 'obs-mobile-preflight.png');
    await page.screenshot({ path: preflightPath });

    const vp = page.viewportSize();
    const vpStr = vp ? `${vp.width}x${vp.height}` : '(viewport not set — window-size controls dimensions)';

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MOBILE CAPTURE READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Playwright viewport : ${vpStr}
  Target window size  : ${MOBILE.width}x${MOBILE.height} (scale factor 1)
  Preflight screenshot: ${preflightPath}

  In OBS Window Capture, select the window titled:
    ${OBS_TITLE}

  ⚠  Do not select your regular Chrome window.
  ⚠  Do not select a wide Chrome window.
  ⚠  Select only the small Playwright mobile capture window.

  Then in OBS: right-click the source → Resize output (source size)

  Expected output must be PORTRAIT (width < height).
    ✓ Good : 390x844, 430x932, 1080x1920
    ✗ Bad  : 1160x1040, 1920x1080, 1280x720

  Press ENTER here when OBS is ready and recording.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  } else {
    console.log(`\n${LABEL} browser is ready. Start OBS recording now.`);
  }
  if (TRIGGER_FILE) {
    console.log('Waiting for go signal...');
    await waitUntil(() => existsSync(TRIGGER_FILE));
  } else {
    await ask('');
  }
  await sleep(1500); // small buffer so the first frame isn't mid-keypress

  await smoothScroll(page);

  console.log(`\n${LABEL} scroll finished. Stop OBS recording now.`);
  if (TRIGGER_FILE) {
    console.log('Waiting for close signal...');
    await waitUntil(() => !existsSync(TRIGGER_FILE));
  } else {
    await ask('Press ENTER to close the browser.');
  }
  await cleanup();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
