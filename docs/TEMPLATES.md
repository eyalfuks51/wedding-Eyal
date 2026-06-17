# Template Strategy — AI-Assisted Template Generation

## Core principle
Templates are **not** generic renderers that swap image paths from the DB. Each template is a **dedicated, hardcoded React component** — hand-crafted for a specific set of visual assets and a specific aesthetic.

**Always hardcoded inside a template:**
- All image assets (hero photos, decorative elements, logos) — imported from `public/` or bundled via Vite
- Color palette, typography, spacing (in the template's own `.scss`)
- Layout structure and decorative HTML

**Always from `content_config` (text/data only):**
- Couple names, quote, invitation text, date fields
- Venue name, address, maps query
- Schedule items (time + label; the `icon` string maps to a hardcoded SVG import inside the template)
- Footer note, closing message, transport details

This split means swapping a template never breaks layout from mismatched image aspect ratios or contrast — images are baked into the template.

## Workflow for adding a template
**Fast path:** run `/guesto-template <style description>` — the skill at
`.claude/skills/guesto-template/` automates clone → Smart Adaptation → impeccable
design → register → test → preview. The manual steps below are what it does under
the hood (and the fallback if you're hand-rolling one).

1. Eyal drops assets into `public/templates/<template-name>/` (e.g. `boho-bg.jpg`, `boho-flower.png`)
2. Eyal writes a prompt describing the aesthetic (fonts, palette, layout, asset placement)
3. Claude clones the closest existing template (`ElegantTemplate` for minimal, `WeddingDefaultTemplate` for decorative)
4. Claude rewrites the SCSS for the new palette/fonts/layout, replacing all hardcoded asset refs
5. Claude registers `'boho': BohoTemplate` in `EventPage.jsx` and updates the registry below

## Template registry
| `template_id` | Component | Assets | Description |
|---|---|---|---|
| `wedding-default` | `WeddingDefaultTemplate` | `public/` (shared) | Warm burgundy/cream, decorative flowers, frame-border images, GSAP scroll animations |
| `elegant` | `ElegantTemplate` | none (CSS-only decor) | Deep navy + gold, Gravitas One / Dancing Script, minimal — no decorative images |
| `wedding-modern` | `WeddingModernTemplate` | `public/templates/` (`refGREEN.png` ref) | "Zine / Retro Bold" — vivid kelly green / mustard / burnt orange, hard zero-blur shadows, grid overlay, jagged ticket clip-paths, inline SVG daisies. BEM namespace `.wm` |
| `constructivist` | `ConstructivistTemplate` | none (CSS-only decor) | "Japanese Constructivist / Bauhaus poster" — strict cream / red / ink, geometric red circle+rect + black semicircle, giant `&` focal glyph, vertical venue rail, hard zero-blur shadows, Futurism-Black/Manhattan + Danidin/Polin. Smart-Adapted from a whisky poster. BEM namespace `.ct` |
| `synesthesia` | `SynesthesiaTemplate` | none (CSS-only decor) | "Synaesthetic spray-art zine" — cream/electric-blue/ink, electric-blue spray blob full of line-art eyes, flanking speakers, wavy wave dividers, condensed-black couple lockup + "+" motif, blue-drenched directions. Smart-Adapted from a SIGHT+SOUND synesthesia poster. BEM namespace `.sy` |

> **The live active event `hagit-and-itai` (the hardcoded dashboard tenant, CLAUDE.md rule 4) runs `template_id='wedding-modern'`** — edit `WeddingModernTemplate` when changing the production wedding's look. (`src/templates/WeddingTemplate/` exists but is NOT registered — dead code, ignore it.)

## Template contract
Every template receives:
```ts
{ event: { id, slug, template_id, content_config }, config: content_config ?? {} }
```
Templates must handle `config` being `{}` — every field optional, never crash on missing data.

Dispatch in `EventPage.jsx`:
```jsx
const TEMPLATES = {
  'wedding-default': WeddingDefaultTemplate,
  'elegant':         ElegantTemplate,
  'wedding-modern':  WeddingModernTemplate,
  // ← register new templates here
};
const Template = TEMPLATES[event.template_id] ?? WeddingDefaultTemplate;
const config   = event.content_config ?? {};
return <Template event={event} config={config} />;
```
