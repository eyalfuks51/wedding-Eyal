-- Demo polish: hagit-and-itai — quote + message history pass
-- Applied 2026-06-21. Dev/demo DB only.

-- 1. Replace English quote with Hebrew Shir HaShirim line
UPDATE events
SET content_config = content_config || '{"quote": "מצאתי את שאהבה נפשי"}'::jsonb
WHERE slug = 'hagit-and-itai';

-- 2. Seed icebreaker send history for all attending guests
--    Sent ~13 days ago (post icebreaker stage, pre-nudge window)
INSERT INTO message_logs (event_id, invitation_id, phone, message_type, content, status, sent_at, scheduled_for)
SELECT
  'f95c0196-1fa7-441c-bc36-c0f9e833f2e8',
  i.id,
  i.phone_numbers[1],
  'icebreaker',
  'היי ' || i.group_name || ', מתרגשים להזמין אתכם לחגוג איתנו! כל הפרטים ולאישור הגעה בקישור האירוע. אוהבים, חגית ואיתי',
  'sent',
  NOW() - INTERVAL '13 days',
  NOW() - INTERVAL '14 days'
FROM invitations i
WHERE i.event_id = 'f95c0196-1fa7-441c-bc36-c0f9e833f2e8'
  AND i.rsvp_status = 'attending';

-- 3. Seed nudge send history for ~half the attending guests (the ones who confirmed quickly)
--    Sent ~7 days ago — these are the guests the nudge "worked" on
INSERT INTO message_logs (event_id, invitation_id, phone, message_type, content, status, sent_at, scheduled_for)
SELECT
  'f95c0196-1fa7-441c-bc36-c0f9e833f2e8',
  i.id,
  i.phone_numbers[1],
  'nudge',
  'היי ' || i.group_name || ', רק מזכירים שהאירוע מתקרב! נשמח לדעת אם תגיעו כדי שנוכל להיערך. אוהבים, חגית ואיתי',
  'sent',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
FROM invitations i
WHERE i.event_id = 'f95c0196-1fa7-441c-bc36-c0f9e833f2e8'
  AND i.rsvp_status = 'attending'
  AND i.invited_pax >= 2;

-- 4. Seed icebreaker send history for pending guests (sent but no reply yet)
INSERT INTO message_logs (event_id, invitation_id, phone, message_type, content, status, sent_at, scheduled_for)
SELECT
  'f95c0196-1fa7-441c-bc36-c0f9e833f2e8',
  i.id,
  i.phone_numbers[1],
  'icebreaker',
  'היי ' || i.group_name || ', מתרגשים להזמין אתכם לחגוג איתנו! כל הפרטים ולאישור הגעה בקישור האירוע. אוהבים, חגית ואיתי',
  'sent',
  NOW() - INTERVAL '13 days',
  NOW() - INTERVAL '14 days'
FROM invitations i
WHERE i.event_id = 'f95c0196-1fa7-441c-bc36-c0f9e833f2e8'
  AND i.rsvp_status = 'pending';
