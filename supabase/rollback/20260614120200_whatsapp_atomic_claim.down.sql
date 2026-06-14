-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK for 20260614120200_whatsapp_atomic_claim.sql
--
-- Drops the atomic-claim RPC and the processing_started_at column.
-- NOTE: re-opens the duplicate-send window (scheduler must also be reverted
-- to its plain SELECT path) — recovery use only.
-- ═══════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.claim_pending_messages(int);

ALTER TABLE public.message_logs
  DROP COLUMN IF EXISTS processing_started_at;
