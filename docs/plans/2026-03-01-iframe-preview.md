# iframe-Based Live Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fragile CSS-scaled div preview with a real `<iframe>` that renders `/preview/:slug` — giving every template a correct mobile viewport (dvh, vw, GSAP ScrollTrigger) with zero per-template maintenance.

**Architecture:** A new `/preview/:slug` React Router route renders `EventPage` with `isPreview=true`. The iframe parent sends the draft `content_config` via `postMessage` on every change. `EventPage` listens and overrides the Supabase config with the received draft. `LivePreview` becomes a thin phone-frame shell around the iframe.

**Tech Stack:** React 18, React Router v6, TypeScript, Vite (same-origin dev + prod)

**Design doc:** `docs/plans/2026-03-01-iframe-preview-design.md`

---

### Task 1: Add `/preview/:slug` route

**Files:**
- Modify: `src/App.jsx`

**Step 1: Add the preview route BEFORE `/:slug`**

Open `src/App.jsx`. Add one line — the new route must come before `/:slug` to avoid slug collision:

```jsx
import { Routes, Route } from 'react-router-dom';
import EventPage from './pages/EventPage';
import NotFoundPage from './pages/NotFoundPage';
import Dashboard from './pages/Dashboard';
import AutomationTimeline from './pages/AutomationTimeline';
import DashboardSettings from './pages/DashboardSettings';

function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/timeline" element={<AutomationTimeline />} />
      <Route path="/dashboard/settings" element={<DashboardSettings />} />
      <Route path="/preview/:slug" element={<EventPage isPreview={true} />} />
      <Route path="/:slug" element={<EventPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
```

**Step 2: Verify manually**

Navigate to `http://localhost:5173/preview/hagit-and-itai` in the browser.
Expected: wedding template renders normally (same as `/hagit-and-itai`). No errors in console.

**Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(preview): add /preview/:slug route for iframe preview"
```

---

### Task 2: Add `postMessage` config bridge to `EventPage`

**Files:**
- Modify: `src/pages/EventPage.jsx`

**Goal:** When `isPreview=true`, listen for `{ type: 'preview-config', config: {...} }` messages from the parent frame and use that config instead of the Supabase one. Also hide the scrollbar (iframe scrolls but shouldn't show the scrollbar track).

**Step 1: Rewrite `EventPage.jsx`**

```jsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useEvent } from '../hooks/useEvent';
import WeddingDefaultTemplate from '../templates/WeddingDefaultTemplate/WeddingDefaultTemplate';
import ElegantTemplate from '../templates/ElegantTemplate/ElegantTemplate';
import NotFoundPage from './NotFoundPage';

// Register new templates here. The key must match event.template_id in the DB.
const TEMPLATES = {
  'wedding-default': WeddingDefaultTemplate,
  'elegant':         ElegantTemplate,
};

function LoadingSpinner() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '2rem' }}>💍</div>
    </div>
  );
}

function EventPage({ isPreview = false }) {
  const { slug } = useParams();
  const { event, loading, notFound } = useEvent(slug);
  const [configOverride, setConfigOverride] = useState(null);

  // ── postMessage bridge (preview mode only) ──────────────────────────────────
  useEffect(() => {
    if (!isPreview) return;

    // Hide scrollbar track in the iframe without disabling scroll
    const style = document.createElement('style');
    style.textContent = `
      ::-webkit-scrollbar { display: none }
      html { scrollbar-width: none; -ms-overflow-style: none; }
    `;
    document.head.appendChild(style);

    const handler = (e) => {
      // Accept only same-origin messages with the correct shape
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'preview-config' && e.data.config) {
        setConfigOverride(e.data.config);
      }
    };
    window.addEventListener('message', handler);

    return () => {
      window.removeEventListener('message', handler);
      document.head.removeChild(style);
    };
  }, [isPreview]);

  if (loading) return <LoadingSpinner />;
  if (notFound || !event) return <NotFoundPage />;

  console.log('Current Template ID:', event.template_id);
  const Template = TEMPLATES[event.template_id] ?? WeddingDefaultTemplate;

  // In preview mode, use the parent's draft config once received; fall back to DB
  const config = (isPreview && configOverride) ? configOverride : (event.content_config ?? {});

  return <Template event={event} config={config} />;
}

export default EventPage;
```

**Step 2: Verify in browser**

1. Open `http://localhost:5173/preview/hagit-and-itai`
2. Open DevTools console, run:
   ```js
   window.postMessage({ type: 'preview-config', config: { couple_names: 'TEST' } }, window.location.origin)
   ```
3. Expected: couple names on the template change to "TEST" immediately without page reload.

**Step 3: Commit**

```bash
git add src/pages/EventPage.jsx
git commit -m "feat(preview): add postMessage config bridge to EventPage"
```

---

### Task 3: Rewrite `LivePreview.tsx` with iframe

**Files:**
- Modify: `src/components/dashboard/LivePreview.tsx`

**Goal:** Replace the CSS-scaled template div + PREVIEW_CSS with a simple iframe shell. Remove `templateId` prop (no longer needed).

**Step 1: Full rewrite of `LivePreview.tsx`**

```tsx
import { useEffect, useRef, useCallback } from 'react';

// Simulated phone viewport — matches a standard iPhone viewport
const PHONE_W = 375;
const PHONE_H = 812;

interface LivePreviewProps {
  event: { id: string; slug: string; template_id: string; event_date: string };
  config: Record<string, any>;
  /** Visual width of the phone content area in px — scale is computed from this */
  width?: number;
}

export default function LivePreview({ event, config, width = 320 }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Keep a ref to always post the latest config (avoids stale closure in onLoad)
  const latestConfig = useRef(config);
  const scale  = width / PHONE_W;
  const frameH = Math.round(PHONE_H * scale);

  // Always keep latestConfig in sync
  useEffect(() => {
    latestConfig.current = config;
  });

  const sendConfig = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'preview-config', config: latestConfig.current },
      window.location.origin,
    );
  }, []);

  // Resend on every config change (iframe may already be loaded)
  useEffect(() => {
    sendConfig();
  }, [config, sendConfig]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phone frame shell */}
      <div
        className="relative rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden"
        style={{ width: `${width + 12}px`, height: `${frameH + 12}px` }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-b-xl z-10" />

        {/* iframe — full phone viewport, CSS-scaled to fit panel */}
        <iframe
          ref={iframeRef}
          src={`/preview/${event.slug}`}
          onLoad={sendConfig}
          title="תצוגה מקדימה"
          style={{
            display:         'block',
            width:           `${PHONE_W}px`,
            height:          `${PHONE_H}px`,
            border:          'none',
            transform:       `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents:   'none',
          }}
        />
      </div>

      <p className="text-[11px] text-slate-400 font-brand">תצוגה מקדימה</p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/LivePreview.tsx
git commit -m "feat(preview): rewrite LivePreview with iframe approach"
```

---

### Task 4: Update `DashboardSettings.tsx` call-sites

**Files:**
- Modify: `src/pages/DashboardSettings.tsx`

**Goal:** Remove the now-unused `templateId` prop from both `<LivePreview>` call sites (desktop sticky panel + mobile overlay).

**Step 1: Find and update both call sites**

Search for `<LivePreview` in `DashboardSettings.tsx`. There are exactly two instances.

**Desktop (around line 642):**
```tsx
// BEFORE:
<LivePreview
  templateId={(event as any).template_id ?? 'wedding-default'}
  event={event as any}
  config={draft}
  width={320}
/>

// AFTER:
<LivePreview
  event={event as any}
  config={draft}
  width={320}
/>
```

**Mobile overlay (around line 662):**
```tsx
// BEFORE:
<LivePreview
  templateId={(event as any).template_id ?? 'wedding-default'}
  event={event as any}
  config={draft}
  width={300}
/>

// AFTER:
<LivePreview
  event={event as any}
  config={draft}
  width={300}
/>
```

**Step 2: Verify no TypeScript errors**

The TypeScript LSP should show no errors in `DashboardSettings.tsx` after removing `templateId`.
Check the terminal / LSP output for diagnostics.

**Step 3: Commit**

```bash
git add src/pages/DashboardSettings.tsx
git commit -m "feat(preview): remove templateId prop from LivePreview calls"
```

---

### Task 5: End-to-end verification

**Goal:** Confirm everything works together before marking the feature complete.

**Step 1: Open `/dashboard/settings` in the browser**

Navigate to `http://localhost:5173/dashboard/settings`.

Expected:
- Phone frame on the right shows the real wedding template
- Template has correct proportions (mobile viewport)
- GSAP animations play (monstera slides in, hero text fades up)
- Scrollbar is hidden inside the iframe

**Step 2: Edit a field and watch it reflect**

Change "שמות הזוג" (couple names) field — type something new.

Expected:
- The names in the phone preview update within ~1 render cycle (no full reload)
- No console errors

**Step 3: Check mobile preview overlay**

Click "תצוגה" button (mobile breakpoint, or narrow the browser window).

Expected:
- Same iframe preview appears in the overlay modal
- Same live-update behavior

**Step 4: Navigate to the real template page**

Navigate to `http://localhost:5173/hagit-and-itai`.

Expected:
- Template renders exactly as before (no regression)
- GSAP animations play correctly
- No `console.log` or `isPreview` traces visible

**Step 5: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore(preview): post-verification cleanup"
```

---

## Rollback

If the iframe approach causes unforeseen issues, revert all 4 task commits:

```bash
git revert HEAD~4..HEAD
```

This restores the CSS-scaled div approach exactly as it was.
