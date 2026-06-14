# Guesto Dashboard Redesign — Assumptions & Variant Proposals

> **Junior Designer checkpoint** — read brief, made assumptions, drafted 3 variants. Show this before any HTML. Wait for direction before coding.

---

## 1 · Position Four — what this dashboard *is*

| Dimension | Choice | Why |
|---|---|---|
| **Narrative role** | Quiet operator's desk for a stressed couple | Bride/groom checks at 11pm before bed, on phone, anxious about who hasn't replied. Not a sales dashboard, not a marketing site — a calm tool. |
| **Viewing distance** | Phone-arm (60% of sessions) + desk-laptop (40%). Desktop is for bulk operations + Excel uploads. | Mobile-first means hero KPI must work at 375px. Desktop adds breathing room, not new info. |
| **Visual temperature** | Warm paper, dusk violet, soft champagne. Never cold-tech. | Wedding industry. Cold slate-blue dashboard is wrong genre — this is editorial stationery, not Stripe. |
| **Capacity estimate** | 50–300 invitations per event. ~30 message logs per invitation lifecycle. One event active at a time. | Numbers stay readable as raw integers. No need for 12k+ row virtualization. |

---

## 2 · Foundation Tokens

### 2.1 Color

```
Paper          #FAF7F2   page background, table base
Paper-2        #F4EFE6   sticky bars, subtle stripe
Ink            #2A2520   primary text (warm black, not #000)
Ink-soft       #6B635A   secondary text
Ink-mute       #A89F94   placeholder, table borders

Violet-700     #6D28D9   primary action, active stage, links
Violet-50      #F5F3FF   hover ghosts, soft fills

Champagne      #E8D5B7   secondary accent, table row hover
Rose-gold      #B76E79   editorial highlight (hero KPI ring, brand mark)
Sage           #7A8466   confirmed/sent state (warmer than emerald)
Apricot        #C97B4A   pending/scheduled (warmer than amber)
Clay           #A85B47   alert/error (warmer than rose-600)

Glass-pane     rgba(255, 250, 245, 0.55)   warm-tinted glass, not pure white
Glass-blur     blur(32px) saturate(1.6)
```

### 2.2 Type — editorial shift

| Role | Font | Weight | Size desktop / mobile |
|---|---|---|---|
| Hero KPI number | **Frank Ruhl Libre** | 500 | 64 / 48 |
| Page title (h1) | **Frank Ruhl Libre** | 500 | 32 / 24 |
| Section heading (h2) | Frank Ruhl Libre | 500 | 20 / 18 |
| Sub-heading | **Assistant** | 600 | 14 / 13 |
| Body / table cell | Assistant | 400 | 14 / 13 |
| Mono / phone numbers | Assistant tabular-nums | 500 | 13 / 12 |
| Brand marks only | Polin / Danidin | retain | retain |

Line-heights: serif 1.15 (display), sans 1.5 (body). RTL strict.

Add Google Fonts import: `Frank+Ruhl+Libre:wght@400;500;700` + `Assistant:wght@300;400;500;600;700`.

### 2.3 Glass dose map (LAYERED — answer to user brief)

**GLASS** (overlay surfaces only):
- StageEditModal (centered modal)
- EditGuestSheet, MessageHistorySheet, StageLogsSheet (side drawers)
- Sticky page header on scroll
- Floating filter bar / floating bulk-action bar
- LivePreview phone-frame chrome (settings page)

**SOLID** (data surfaces — readability first):
- KPI cards (warm white `#FFFFFF`, soft champagne border)
- Guest table rows
- Settings form inputs
- Timeline stage cards (solid pane, not glass)

Reasoning: Eyal's brief said "data surfaces (tables, forms) solid for readability" — locked.

### 2.4 Spacing & radius

```
radius-xs  6px   inputs, badges
radius-sm  10px  buttons, chips
radius-md  16px  cards, table container
radius-lg  24px  modal, sheet, hero KPI
radius-pill 999px badges/pills

space scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
```

### 2.5 Motion

| Action | Duration | Easing |
|---|---|---|
| Card hover lift | 220ms | cubic-bezier(0.32, 0.72, 0.30, 1) |
| Modal enter | 280ms | ease-out (scale 0.96 → 1, opacity 0 → 1) |
| Sheet slide | 320ms | ease-out |
| Page nav fade | 200ms | linear |
| Magnetic button | 180ms | ease-out (translate 0 → 1px on hover) |

No bounces. No springs. Calm.

---

## 3 · KPI Hierarchy — actionable, not vanity

### 3.1 Hero (one card, takes 100% width on mobile, 50% on desktop)

**"מאושרים — 142 / 180"**
- Frank Ruhl Libre 64px on the `142`
- Progress ring 78% in rose-gold, ring background champagne-30%
- Caption sans 13px: `78% מהקיבולת · יעד: 180 אורחים`
- Breakdown chips below: ✓ 142 מאושרים · ⌛ 24 ממתינים · ✗ 14 מסרבים
- Capacity is editable inline (`venue_capacity` — needs new field in `events.content_config`, flagged as TBD for Eyal)

### 3.2 Action card (clickable affordance — primary CTA on dashboard)

**"24 ממתינים לתשובה"** card
- Warm violet-50 background (NOT solid violet — too loud)
- Hover lifts + magnetic, cursor pointer
- Click → filters guest table to `rsvp_status=pending`, scrolls table into view, opens floating bulk-action bar pre-armed for "שלח תזכורת"
- Sub-line: `מתוכם 8 ללא תזכורת אחרונה ב-7 ימים אחרונים` (computed from `last_message_sent_at`)

### 3.3 Alert chips (small, conditional)

Only render when count > 0:
- 🔔 `3 ביטולים אחרונים (ב-48 שעות)` — clay tint
- 🍽 `5 דרישות תזונה מיוחדות` — apricot tint (TBD: needs `dietary_notes` field, flagged for Eyal)

### 3.4 Demoted stats (footer strip, smaller type)

Single row of muted stats:
`87 הודעות נשלחו · 92% הצלחה · 4 בתור · עודכן לפני 2 דק׳`

No card chrome, no icons, sans 12px ink-soft. Operational telemetry, not a hero.

### 3.5 Replaces current 4-card layout

Current (Dashboard.tsx:1360-1410):
```
[הזמנות 87] [סה"כ אורחים 312] [ממתינים 24] [שגיאות 4]
```

Becomes:
```
┌─────────────────────────────┬──────────────────┐
│ HERO: Confirmed/Capacity    │ ACTION: Pending  │
│ + ring + breakdown chips    │ + click hint     │
└─────────────────────────────┴──────────────────┘
[ alert chip · alert chip ]            (only if > 0)
[ demoted stats strip — muted ]
```

---

## 4 · Page-specific structure

### 4.1 `/dashboard`

- Sticky top bar: brand mark (Frank Ruhl Libre "Guesto") + tab nav + event picker
- Hero+Action KPI row
- Filter bar — solid card on mobile, glass when sticky
- Guest table — solid white, champagne row separators (hairline, not full borders), hover row champagne-15%
- Floating bulk-action bar — glass, slides from bottom, only when rows selected
- Excel upload button in header (small ghost button, not primary)

### 4.2 `/dashboard/timeline`

Keep horizontal RTL drag-scroll on desktop (Eyal said keep). Modernize:
- **Connecting line** thin gradient violet→champagne, 1px not 2px
- **Stage cards** w-56 (was w-48 — needs more breathing room), solid white pane, soft champagne border, status pill top-right
- **Icon circles** on line — solid, no fill on default, fill violet only on `active`
- **Status colors** rewarmed: sage (sent) / violet (active) / apricot (scheduled) / ink-mute 50% (disabled)
- **Add-nudge slot** — dashed champagne border, "+" centered, hover fills champagne-30%
- **Mobile** vertical stack — `border-r-4` becomes `border-r-2` rose-gold; tighter card spacing

### 4.3 `/dashboard/settings`

Sticky split-pane already exists — keep. Restyle:
- Form inputs: warm white bg, champagne border, violet focus ring (was slate)
- Section headers Frank Ruhl Libre 18px
- Sticky save bar — glass on scroll, solid on mobile bottom
- LivePreview phone-frame: chrome glass, bezel deep violet hairline

---

## 5 · Three variant DNA cards

All three share §2 tokens, §3 KPI strategy, §4 structure. Difference is **emphasis** — how serif-forward, how dense, how decorative. Pick one, refine, build full hi-fi.

### 🎩 Variant A — Editorial Atelier

> **DNA**: A wedding stationery designer's bench. Most serif-forward. Magazine whitespace. Rose-gold prominent.

- Frank Ruhl Libre on **all** headings, KPI numbers, AND section labels
- Page padding desktop: 64px sides (vs 48 in B, 32 in C)
- Hero KPI ring: 200px diameter, rose-gold gradient (heavier presence)
- Table row height: 56px (most breathing)
- One decorative flourish per page — small Frank-Ruhl ampersand watermark in hero corner, opacity 0.06
- Alert chips have small serif italic captions
- **Risk**: too "wedding website" if overdone. Mitigated by keeping data surfaces clinical.

### 🥂 Variant B — Premium Balanced (recommended starting point)

> **DNA**: 50/50 serif-sans split. Stripe-clean tables, Airbnb warmth. Champagne + violet equal play.

- Frank Ruhl Libre only on h1 + hero KPI number; everything else Assistant
- Page padding desktop: 48px sides
- Hero KPI ring: 160px diameter, rose-gold but no gradient
- Table row height: 48px
- No decorative watermarks
- Sub-headings sans 600 weight in violet-700 (operator-feel)
- Magnetic hover on cards but not on table rows
- **Risk**: safest, but could read "generic premium SaaS" if accents not handled. Mitigated by warm-paper base + champagne row hover.

### 📐 Variant C — Operator's Editorial

> **DNA**: Density-first. Serif only on hero numbers + page titles. Champagne thin hairlines. For power users on desktop.

- Frank Ruhl Libre on hero KPI number + h1 page title only — everything else Assistant
- Page padding desktop: 32px sides
- Hero KPI ring: 128px diameter
- Table row height: 40px (densest)
- Filter bar inline with table header (no separate row)
- Demoted stats moved to top-right of header (smaller real estate)
- Alert chips become inline icons in table rows (no chip strip)
- **Risk**: less wedding-feel, more admin-tool-feel. Mitigated by warm-paper base + serif on h1/hero.

---

## 6 · Anti-AI-slop checklist (auditing my own output)

- ✅ No glass on data surfaces (locked per brief)
- ✅ Warm paper not cold slate (locked per brief)
- ✅ Editorial type not Inter-default (Frank Ruhl Libre + Assistant)
- ✅ KPIs are actionable, not 4 generic count cards
- ✅ Status colors warmed (sage/apricot/clay vs emerald/amber/rose)
- ✅ No emoji in UI chrome (only in alert chip prefixes, optional)
- ✅ No "left border accent" cards (champagne hairlines instead)
- ✅ No purple-cyan gradient anywhere
- ✅ Decorative flourishes earn their place (one max per page in Variant A, none in B/C)
- ⚠️ TBD: `venue_capacity` field doesn't exist yet on `events` — flag for Eyal (add to `content_config.venue_capacity`?)
- ⚠️ TBD: `dietary_notes` doesn't exist yet on `invitations` — flag for Eyal (defer to Phase 4? or add now?)

---

## 7 · Open questions for Eyal

1. **Variant pick** — A / B / C? Or mix (e.g., "B's structure with A's serif intensity")?
2. **`venue_capacity`** — add field now to enable hero ring properly, or hardcode demo value 180 in mockup?
3. **`dietary_notes`** — show alert chip in mockup as future-feature placeholder, or omit?
4. **Hero KPI metric** — "מאושרים / קיבולת" (heads vs venue capacity) is my read of brief. Confirm?
5. **Decorative flourish** in Variant A — yay or too much?
6. **Mobile hero ring** — keep ring at 120px on mobile, or collapse to bar progress to save vertical space?

---

## 8 · Next step (after Eyal picks direction)

1. Build mini variant HTML showcases — `/dashboard` mockup at 1440px + 375px for the chosen variant (or all 3 if Eyal wants to compare)
2. Real Hebrew data: real names, real phone numbers (masked), real WhatsApp template text from `content_config.whatsapp_templates`
3. After mini approved → full hi-fi for all 3 pages (timeline + settings)
4. Playwright validation pass
5. Translate to React/Tailwind code in actual `src/pages/*.tsx` files

**Do not start HTML until Eyal confirms direction.**
