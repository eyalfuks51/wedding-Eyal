-- ═══════════════════════════════════════════════════════════════
-- Drop legacy global phone uniqueness constraint
-- ═══════════════════════════════════════════════════════════════
-- arrival_permits_phone_key enforces phone uniqueness across ALL
-- events. With multi-event support, a phone should only be unique
-- per event (arrival_permits_event_phone_unique). The old constraint
-- blocks guests who RSVP to more than one event.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE arrival_permits DROP CONSTRAINT IF EXISTS arrival_permits_phone_key;
