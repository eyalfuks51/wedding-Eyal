# Template screenshots

Drop one screenshot per wedding template here. The landing-page carousel
(`components/ui/feature-carousel.tsx`, used in `app/page.tsx`) picks them up
automatically — no code change needed.

## Filenames (must match exactly)

| File | Template |
|---|---|
| `wedding-modern.png` | Modern — רטרו צבעוני |
| `elegant.png` | Elegant — בוהו אלגנטי |
| `wedding-default.png` | Default — קלאסי חם |

## Format

- **Portrait** phone screenshots (the card is tall, ~9:16). Recommended ~1080×1920.
- `.png` or `.jpg` — if you use `.jpg`, update the matching `src` in `app/page.tsx`.
- Images are cropped `object-fit: cover` from the **top**, so keep the couple
  name / hero near the top of the shot.

Until a file exists, the carousel shows a branded placeholder in the template's
palette, so the section still looks intentional.
