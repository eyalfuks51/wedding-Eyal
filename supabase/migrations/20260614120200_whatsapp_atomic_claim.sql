-- ═══════════════════════════════════════════════════════════════════════
-- WhatsApp scheduler: atomic queue claiming (duplicate-send safety)
--
-- PROBLEM (pre-migration live state):
--   The whatsapp-scheduler edge function selected message_logs rows with
--   status='pending' and then sent them — with no claim step. Two overlapping
--   invocations (e.g. a slow run still sending while the */5 cron fires the
--   next one, or a manual force_run alongside the cron) both SELECT the same
--   pending rows and both send them → duplicate WhatsApp messages to guests.
--
-- FIX:
--   Atomic claim via claim_pending_messages(): a single UPDATE transitions
--   due rows pending -> processing using FOR UPDATE SKIP LOCKED, so two
--   concurrent callers receive disjoint row sets. The edge function then
--   sends only the rows IT claimed and transitions each to 'sent'/'failed'.
--   A row can therefore be claimed (and sent) at most once.
--
--   DESIGN CHOICE — at-most-once, NOT at-least-once:
--   This function deliberately does NOT auto-reclaim rows stuck in
--   'processing'. Green API sends are not idempotent (no client dedup key),
--   so any automatic reclaim window reopens a duplicate-send vector: if a send
--   succeeds but the follow-up 'sent' DB update fails (or a worker is still
--   alive past the window), reclaim would re-send an already-delivered message.
--   For a guest-facing launch we prioritise "never message a guest twice" over
--   "never strand a message". A row stuck in 'processing' (rare: worker crash
--   between send and status write) is therefore left for manual requeue / alert,
--   NOT auto-resent. processing_started_at is retained purely for observability
--   (when a row was claimed) and as the anchor for a future bounded-lease design
--   if at-least-once is ever needed.
--
-- Execution is restricted to service_role (the edge function's key); no
-- client role can claim the queue.
--
-- Paired rollback: supabase/rollback/20260614120200_whatsapp_atomic_claim.down.sql
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.message_logs
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_pending_messages(
  p_limit int DEFAULT 15
)
RETURNS SETOF public.message_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.message_logs m
  SET status = 'processing',
      processing_started_at = now()
  WHERE m.id IN (
    SELECT c.id
    FROM public.message_logs c
    WHERE c.status = 'pending'
      AND (c.scheduled_for IS NULL OR c.scheduled_for <= now())
    ORDER BY c.scheduled_for ASC NULLS FIRST
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING m.*;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_pending_messages(int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_pending_messages(int) TO service_role;
