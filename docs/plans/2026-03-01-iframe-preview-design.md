# Design: iframe-Based Live Preview

**Date:** 2026-03-01
**Status:** Approved
**Context:** Replace the fragile CSS-scale preview with a true iframe approach that works for all templates without per-template maintenance.

---

## Problem

The current `LivePreview` renders a template inside a scaled `div`. This breaks:
- `100dvh` / `vw` / `vh` units (resolve to browser viewport, not the simulated phone)
- GSAP `ScrollTrigger` (listens to browser window scroll, never fires inside the div)
- Any future template that uses viewport-relative positioning

Every new template would require custom CSS overrides in `LivePreview`. This is unacceptable maintenance cost.

---

## Solution: `<iframe>` with `postMessage` config bridge

The preview renders a real browser page inside an `<iframe>` sized to 375 × 812 px, then CSS-scaled to fit the panel. Inside the iframe, the full app runs — `100dvh = 812px`, GSAP works, scrolling works. The parent syncs the draft config to the iframe via `postMessage`.

### Architecture

```
DashboardSettings
  └── <LivePreview event config width>
       └── <iframe src="/preview/:slug">
            └── React Router → /preview/:slug route
                 └── EventPage (isPreview=true)
                      ├── useEvent(slug)       ← loads base event from Supabase
                      ├── postMessage listener ← receives config override from parent
                      └── <Template event config>  ← config = override ?? supabase
```

### Data Flow

1. `DashboardSettings` renders `LivePreview` with `event` + `config` (draft state)
2. `LivePreview` renders `<iframe src="/preview/hagit-and-itai">`
3. Iframe loads → fires `onLoad` → parent sends `postMessage({ type: 'preview-config', config: draft })`
4. `EventPage` (inside iframe) receives message → `setConfigOverride(draft)` → re-renders template
5. Every time user edits a field → `config` changes → parent sends new `postMessage` → template re-renders

No iframe reloads after initial load. All updates are instant React state changes.

---

## File Changes

### 1. `src/App.jsx`
Add one route before `/:slug`:
```jsx
<Route path="/preview/:slug" element={<EventPage isPreview={true} />} />
```

### 2. `src/pages/EventPage.jsx`
Add `isPreview` prop:
- `useState(null)` for `configOverride`
- `useEffect` listening to `window.addEventListener('message', ...)` when `isPreview=true`
- Hide scrollbar in preview mode (inject `<style>` into `document.head`)
- Final config = `(isPreview && configOverride) ? configOverride : event.content_config ?? {}`

### 3. `src/components/dashboard/LivePreview.tsx` (full rewrite)
- Remove all `PREVIEW_CSS` and CSS override logic
- Remove `templateId` prop (no longer needed — iframe dispatches template internally)
- Add `iframeRef: RefObject<HTMLIFrameElement>`
- Keep `latestConfig` ref to always send freshest config
- `onLoad` → `sendConfig()`
- `useEffect([config])` → `sendConfig()`
- `sendConfig` posts `{ type: 'preview-config', config: latestConfig.current }` to `iframeRef.current.contentWindow`
- Phone frame keeps same visual shell (rounded corners, notch, shadow)

### 4. `src/pages/DashboardSettings.tsx`
- Remove `templateId` prop from both `<LivePreview>` calls (desktop + mobile overlay)

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Config changes before iframe loads | `onLoad` sends latest `latestConfig.current` ref — no data lost |
| User types fast | `postMessage` is synchronous and cheap — no debounce needed |
| Draft === Supabase config | No visible flicker (iframe shows same data both before and after postMessage) |
| Draft differs from Supabase | ~1 React render flicker on initial load — acceptable |
| Same-origin security | `postMessage` uses `window.location.origin` as `targetOrigin` — safe |

---

## What Does NOT Change

- Template code (ElegantTemplate, WeddingDefaultTemplate) — zero modifications
- Supabase data fetching — iframe does its own `useEvent` call
- Dashboard settings form — no changes beyond removing `templateId` from LivePreview call
- Phone frame visual design (rounded corners, notch, shadow, label)

---

## Non-Goals

- Offline/no-network preview (iframe still needs Supabase for initial load)
- Preview for templates not yet in the DB (out of scope)
- Two-way communication from iframe back to parent
