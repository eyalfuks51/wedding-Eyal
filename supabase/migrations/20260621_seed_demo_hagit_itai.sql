-- Demo seed: hagit-and-itai event — realistic portfolio data pass
-- Applied 2026-06-21. Dev/demo DB only. No schema changes.

-- 1. Fix event metadata
UPDATE events SET
  partner1_name = 'חגית',
  partner2_name = 'איתי',
  event_date    = '2026-10-20'
WHERE slug = 'hagit-and-itai';

-- 2. Replace all invitations with realistic demo set
DELETE FROM invitations
WHERE event_id = 'f95c0196-1fa7-441c-bc36-c0f9e833f2e8';

INSERT INTO invitations (
  event_id, group_name, phone_numbers,
  invited_pax, confirmed_pax, rsvp_status,
  side, guest_group, is_automated, messages_sent_count
) VALUES

-- ── משפחה / חתן ────────────────────────────────────────────────────
('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'דוד ורות לוי',
  ARRAY['0524837192','0507293841'], 4, 4, 'attending', 'חתן', 'משפחה', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'ג''קי ונינה כהן',
  ARRAY['0548372910'], 2, 2, 'attending', 'חתן', 'משפחה', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'יוסי ודניאלה פרץ',
  ARRAY['0539281047','0503746182'], 2, 2, 'attending', 'חתן', 'משפחה', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'נחום וחנה פישר',
  ARRAY['0527461839'], 2, 0, 'declined', 'חתן', 'משפחה', false, 1),

-- ── משפחה / כלה ────────────────────────────────────────────────────
('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'שמשון ומרים גולדברג',
  ARRAY['0584739201','0523816470'], 2, 2, 'attending', 'כלה', 'משפחה', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'רון וגלית ברק',
  ARRAY['0558293741'], 3, 3, 'attending', 'כלה', 'משפחה', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'גיל ויעל שניר',
  ARRAY['0547382910','0503827461'], 4, 0, 'pending', 'כלה', 'משפחה', false, 1),

-- ── חברים / כלה ────────────────────────────────────────────────────
('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'אמיר ונועה שפירא',
  ARRAY['0526391847'], 2, 2, 'attending', 'כלה', 'חברים', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'הילה ורפאל אזולאי',
  ARRAY['0508473920','0543827164'], 3, 3, 'attending', 'כלה', 'חברים', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'מיכל וגל אברהם',
  ARRAY['0557381924'], 2, 0, 'pending', 'כלה', 'חברים', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'רינה גבאי',
  ARRAY['0532847196'], 1, 0, 'declined', 'כלה', 'חברים', false, 1),

-- ── חברים / חתן ────────────────────────────────────────────────────
('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'תמי ומיכאל אדלר',
  ARRAY['0518293740'], 2, 2, 'attending', 'חתן', 'חברים', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'עינב וליאל מזרחי',
  ARRAY['0549273810','0504738291'], 2, 2, 'attending', 'חתן', 'חברים', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'טל ודנה רוזנברג',
  ARRAY['0528374910'], 2, 0, 'pending', 'חתן', 'חברים', false, 1),

-- ── צבא / חתן ──────────────────────────────────────────────────────
('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'ניר אלחנן',
  ARRAY['0543829174'], 1, 1, 'attending', 'חתן', 'צבא', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'שירה גולן',
  ARRAY['0502837491'], 1, 1, 'attending', 'חתן', 'צבא', false, 0),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'עמוס שושני',
  ARRAY['0587294013'], 1, 0, 'pending', 'חתן', 'צבא', false, 0),

-- ── עבודה / כלה ────────────────────────────────────────────────────
('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'דבורה ודוד קליין',
  ARRAY['0525839174'], 2, 2, 'attending', 'כלה', 'עבודה', false, 1),

('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'אורי בן-דוד',
  ARRAY['0543729018'], 1, 1, 'attending', 'כלה', 'עבודה', false, 1),

-- ── עבודה / חתן ────────────────────────────────────────────────────
('f95c0196-1fa7-441c-bc36-c0f9e833f2e8', 'מיה ורן הרמן',
  ARRAY['0507384921','0527419038'], 2, 2, 'attending', 'חתן', 'עבודה', false, 1);
