import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import SynesthesiaTemplate from './SynesthesiaTemplate';

// RsvpForm pulls in the Supabase client; the contract test only cares that the
// template renders. Stub it out (also keeps this a pure node/SSR render).
vi.mock('../../components/RsvpForm/RsvpForm', () => ({ default: () => null }));

const event = { id: 'evt-1', slug: 'test', template_id: 'synesthesia' };

describe('SynesthesiaTemplate contract', () => {
  it('renders with empty config without throwing', () => {
    const html = renderToStaticMarkup(
      createElement(SynesthesiaTemplate, { event, config: {} })
    );
    expect(html).toContain('sy__hero');
  });

  it('renders a full config (every shared content_config key)', () => {
    const config = {
      couple_names: 'מור & אייל',
      quote: 'שניים נפגשו',
      invitation_text: 'מתחתנים',
      date_display: '09.07.2026',
      date_hebrew: 'כ״ג בתמוז',
      day_of_week: 'חמישי',
      venue_name: 'האחוזה',
      venue_address: 'תל אביב',
      venue_address_full: 'רחוב הברזל 1, תל אביב',
      venue_maps_query: 'האחוזה תל אביב',
      schedule: [
        { time: '19:00', label: 'קבלת פנים', icon: 'food' },
        { time: '20:00', label: 'חופה', icon: 'marry' },
        { time: '21:00', label: 'ריקודים', icon: 'dance' },
      ],
      footer_note: 'נשמח לראותכם',
      closing_message: 'באהבה',
      train_line: '1',
      train_station: 'המרכזית',
      train_walk_minutes: 5,
      parking_lot: 'הגדול',
      parking_walk_minutes: 3,
    };
    const html = renderToStaticMarkup(
      createElement(SynesthesiaTemplate, { event, config })
    );
    expect(html).toContain('אייל');
    expect(html).toContain('דרכי הגעה');
    expect(html).toContain('קבלת פנים');
  });
});
