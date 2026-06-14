import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  ONBOARDING_TEMPLATES,
  buildInviteUrl,
  buildOnboardingContentConfig,
  buildSlugPreview,
} from './onboarding-model';

describe('onboarding model', () => {
  it('exposes the real event template ids used by the product', () => {
    expect(ONBOARDING_TEMPLATES.map(template => template.id)).toEqual([
      'wedding-modern',
      'elegant',
      'wedding-default',
    ]);
  });

  it('builds the RPC content_config payload from event details', () => {
    expect(
      buildOnboardingContentConfig({
        partner1: 'אייל',
        partner2: 'מור',
        date: '2026-09-03',
        venue: 'בית על הים',
      }),
    ).toEqual({
      couple_names: 'אייל & מור',
      date_display: '2026-09-03',
      venue_name: 'בית על הים',
    });
  });

  it('normalizes invitation links without duplicating slashes', () => {
    expect(buildInviteUrl('http://localhost:5173/', 'eyal-and-mor')).toBe(
      'http://localhost:5173/eyal-and-mor',
    );
  });

  it('builds a deterministic display-only slug preview without the random suffix', () => {
    expect(buildSlugPreview('אייל', 'מור')).toBe('אייל-and-מור');
  });

  it('keeps the pre-create wizard to three operational steps', () => {
    expect(ONBOARDING_STEPS.map(step => step.id)).toEqual([1, 2, 3]);
  });
});
