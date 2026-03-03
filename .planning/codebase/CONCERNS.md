# Codebase Concerns

**Analysis Date:** 2026-03-03

## Tech Debt

**Loose TypeScript in Event/Template Handling:**
- Issue: Multiple `as any` casts throughout the codebase, particularly when accessing `event.content_config` and `event.automation_config`.
- Files: `src/pages/AutomationTimeline.tsx` (lines 296, 297, 298), `src/pages/DashboardSettings.tsx` (lines 232, 236, 273), `src/components/dashboard/LivePreview.tsx`
- Impact: Loss of type safety around critical configuration objects. Changes to schema shape won't be caught at compile time. Makes refactoring risky.
- Fix approach: Create strict TypeScript interfaces for `event.content_config` shape (already partially done in `DashboardSettings.tsx` lines 24-46). Extend `EventData` interface in `src/contexts/EventContext.tsx` to include properly-typed `content_config` and `automation_config`. Remove all `as any` casts.

**Supabase Null Coalescing Scattered Across Components:**
- Issue: Repeated pattern of `supabase!` non-null assertions in `AuthContext.tsx` (lines 19, 24, 32) without null-safety checks. If Supabase initialization fails, these will throw at runtime instead of being handled gracefully.
- Files: `src/contexts/AuthContext.tsx`, `src/lib/supabase.js` has defensive checks (lines 6-12) but Context doesn't
- Impact: Auth errors crash the app rather than showing graceful fallback UI. Production failures in authentication are not recoverable.
- Fix approach: Create a safe wrapper hook that validates `supabase` exists before using it. Or ensure `AuthProvider` early-exits if Supabase is null. Add try-catch around `getSession()` call (line 19).

**No Retry Logic for Database Queries:**
- Issue: All async operations in dashboard pages (`src/pages/Dashboard.tsx`, `src/pages/AutomationTimeline.tsx`) have no retry on transient failures. Network flakes or Supabase service interruptions will fail immediately.
- Files: `src/pages/Dashboard.tsx` (lines 350+), `src/pages/AutomationTimeline.tsx` (lines 180+), all functions in `src/lib/supabase.js`
- Impact: Unreliable dashboard experience. Guests table may fail to load on poor connections. Timeline automation queries may not persist changes.
- Fix approach: Implement exponential backoff retry wrapper for Supabase queries. Consider React Query / TanStack Query for automatic retry + caching.

**Stale Message History After Rapid Re-opens:**
- Issue: `src/components/dashboard/StageLogsSheet.tsx` uses an `ignored` flag to prevent stale updates (comment on line ~40), but this is only local to the component. If two StageLogsSheet instances open simultaneously (parent/child, or rapid toggle), the second one's ignored flag won't cancel the first one's fetch.
- Files: `src/components/dashboard/StageLogsSheet.tsx` (lines 35-45)
- Impact: Race condition can display wrong message history for the wrong stage/guest if sheets are toggled rapidly.
- Fix approach: Use AbortController per-sheet instance instead of boolean flag. Or ensure only one sheet can be open at a time via parent state management.

## Known Bugs

**Phone Normalization Inconsistency:**
- Symptoms: Phone numbers are normalized differently in different parts of the pipeline — Excel parser normalizes to international format (972...), RSVP form strips to 10 digits, WhatsApp scheduler re-normalizes again.
- Files: `src/lib/guest-excel.ts` (lines 59-69), `src/components/RsvpForm/RsvpForm.jsx` (line 93), `supabase/functions/whatsapp-scheduler/index.ts` (lines 43-47)
- Trigger: Upload guests with phone "054-633-9018", then submit RSVP with "0546339018", then check if scheduler sends to same guest. Phone formats may not match in invitations lookup.
- Workaround: Normalize all phones to 972 format before storing in DB. Create single `normalizePhone()` utility imported everywhere.

**Message Status Badge Click Sometimes Doesn't Open Drawer:**
- Symptoms: Clicking a message status badge in the guest table occasionally doesn't open `MessageHistorySheet`.
- Files: `src/pages/Dashboard.tsx` (line 214), `src/components/dashboard/StageLogsSheet.tsx`
- Trigger: Happens after bulk guest operations or rapid table filtering. `selectedMessageLog` state may not sync properly.
- Workaround: Close and re-open the guest table or refresh the page.

**Excel Upload: Type Coercion on Empty Cells:**
- Symptoms: Cells with no value in the Excel template are read as `undefined`, then coerced to empty strings or 0. If a user leaves "כמות מוזמנים" (invited_pax) blank, it defaults to 0, which is invalid (should be >= 1).
- Files: `src/lib/guest-excel.ts` (line 109), validation logic around line 140+
- Trigger: Upload Excel with empty invited_pax cell.
- Workaround: Always fill in all required fields in the Excel template. Validation should reject empty pax counts before insert.

## Security Considerations

**Hardcoded Event Slug in Dashboard:**
- Risk: The dashboard was initially written to fetch a hardcoded `'hagit-and-itai'` slug. While this has been replaced with multi-tenant context via `useEventContext`, older comments and logic may still reference the hardcoded slug.
- Files: Check `src/pages/Dashboard.tsx`, `src/pages/AutomationTimeline.tsx` — search for `'hagit-and-itai'` to confirm it's gone.
- Current mitigation: Multi-tenant auth via `AuthProvider` + `ProtectedRoute` now enforces user ownership via `user_events` table.
- Recommendations: Audit for any remaining hardcoded slug references. Ensure all event queries use `event_id` from context, never slug alone.

**Anon RLS Policy on `arrival_permits` Table:**
- Risk: `arrival_permits` allows anon INSERT, UPDATE, SELECT with no filtering (RLS: `USING true, WITH CHECK true`). Any unauthenticated user can see all RSVP submissions across all events.
- Files: Database schema (RLS policies), `src/components/RsvpForm/RsvpForm.jsx` calls `submitRsvp()` with no auth required.
- Current mitigation: Data is not sensitive (names + phone numbers + attendance), and the API is public (guests submit RSVPs from public links). Event-specific data is protected by URL slug isolation.
- Recommendations: Consider adding `event_id` filtering to anon RLS on `arrival_permits` to prevent cross-event data leakage. Or switch to auth-required submission.

**Google Service Account Credentials in Edge Functions:**
- Risk: `supabase/functions/sync-to-sheets/index.ts` reads `GOOGLE_PRIVATE_KEY` from env vars (line 6). If private key is logged or leaked, Google Sheets access is compromised.
- Files: `supabase/functions/sync-to-sheets/index.ts` (lines 5-6)
- Current mitigation: Env vars are stored in Supabase secrets, not committed to repo. Deno function runs with limited permissions.
- Recommendations: Ensure `GOOGLE_PRIVATE_KEY` is never logged. Add audit logging for all Google Sheets API calls. Consider using a service account with minimal permissions (read-write only to specific sheet).

**WhatsApp API Credentials in Environment:**
- Risk: `GREEN_API_INSTANCE_ID` and `GREEN_API_TOKEN` are required env vars in the scheduler (lines 8-15). If compromised, attacker can send WhatsApp messages as the event.
- Files: `supabase/functions/whatsapp-scheduler/index.ts`
- Current mitigation: Secrets stored in Supabase, function is internal (called via Supabase jobs, not exposed publicly).
- Recommendations: Rotate `GREEN_API_TOKEN` regularly. Implement rate limiting and message logging to detect abuse. Consider adding message approval queue for critical stages (e.g., ultimatum).

## Performance Bottlenecks

**Full Guest Table Load on Dashboard Mount:**
- Problem: `Dashboard.tsx` fetches all invitations + all message_logs + all automation_settings in parallel on mount (lines 350-380). For large events (>500 guests), this can be 1000+ rows.
- Files: `src/pages/Dashboard.tsx` (lines 350-380)
- Cause: No pagination or lazy loading. Table renders all rows even if user only views first 20.
- Improvement path: Implement virtual scrolling (e.g., `react-window`) for the guest table. Paginate message_logs — fetch full history only when drawer opens. Add debounced search to avoid refetching on every keystroke.

**Message History Sheet Joins All Invitations:**
- Problem: `fetchStageMessageLogs()` fetches all message_logs for a stage and joins with invitations (line 130 in supabase.js). For a stage with 1000 messages, this can be slow.
- Files: `src/lib/supabase.js` (lines 126-136)
- Cause: No filtering by guest/stage until after fetch. Query returns all rows for all guests.
- Improvement path: Add server-side filtering: `.eq('invitation_id', invitationId)` to only fetch history for a single guest. Reduce payload from 1000 rows to ~5.

**Automation Engine Batch Size Unrestricted:**
- Problem: `supabase/functions/automation-engine/index.ts` fetches all active automation settings without limit (line 103). If there are 100+ events with automation, startup time is slow.
- Files: `supabase/functions/automation-engine/index.ts` (lines 101-118)
- Cause: No pagination or filtering by recent events.
- Improvement path: Add `.limit(50)` and process in batches. Or trigger per-event instead of globally.

**Message Scheduler Processes 15 at a Time (Rate Limit):**
- Problem: `whatsapp-scheduler/index.ts` processes max 15 messages per invocation (line 130). If queue has 1000 pending messages, scheduler needs 67 invocations to clear.
- Files: `supabase/functions/whatsapp-scheduler/index.ts` (line 130)
- Cause: Green API has rate limits; hard-coded limit of 15 to avoid hitting them.
- Improvement path: Make batch size configurable via env var. Implement exponential backoff if Green API returns 429 (rate limit). Monitor queue depth and scale invocation frequency.

## Fragile Areas

**Dashboard State Sync Between Tabs:**
- Files: `src/pages/Dashboard.tsx` (350+), `src/pages/AutomationTimeline.tsx` (180+)
- Why fragile: Both tabs fetch event data independently. If user edits event in Settings tab, Dashboard tab won't reflect changes until manual refresh.
- Safe modification: Always use `useEventContext().refetch()` after saves in DashboardSettings (line 290). Ensure all event mutations trigger context refresh.
- Test coverage: No tests for multi-tab sync. Manual testing required.

**Edit Guest Sheet Validation:**
- Files: `src/components/dashboard/EditGuestSheet.tsx` (lines 100+)
- Why fragile: Phone number array can be empty. If user clears all phones and saves, the invitation loses its identity (used for matching in bulkUpsert). Confirmed_pax can exceed invited_pax.
- Safe modification: Add validation before save (lines 140+): ensure at least one phone, ensure confirmed_pax <= invited_pax. Show error toast instead of saving silently.
- Test coverage: None. Manual testing only.

**WhatsApp Template Variable Interpolation:**
- Files: `supabase/functions/automation-engine/index.ts` (lines 47-49)
- Why fragile: `interpolate()` function uses simple regex `.replace(/\{\{(\w+)\}\}/g, ...)`. If template contains `{{name}}` but no `name` variable is provided, it leaves `{{name}}` in the message.
- Safe modification: Log warnings when variables are missing. Validate template variables exist before inserting message_log row. Or provide sensible defaults (e.g., `{{name}}` → `אורח`).
- Test coverage: No unit tests for interpolation. Only manual message queue inspection.

**Stage Edit Modal Form State:**
- Files: `src/components/dashboard/StageEditModal.tsx` (lines ~100+)
- Why fragile: Form state is local to the modal. If save fails mid-request, user won't know whether the change was applied or not. Optimistic updates not implemented.
- Safe modification: Add `isSaving` state with loading spinner. Show success/error toast after each save attempt. Or implement optimistic update (update UI first, revert on error).
- Test coverage: No tests. Manual testing only.

## Scaling Limits

**Guest Table: 1000+ Rows Performance:**
- Current capacity: Dashboard renders all invitations in a single HTML table. Tested with ~100 rows. Performance degrades at ~500+ rows.
- Limit: Browser memory and re-render time. Scrolling becomes laggy. Filter/search takes seconds.
- Scaling path: Implement virtual scrolling (react-window). Paginate results (50 per page). Add server-side full-text search on `group_name` / `phone_numbers`.

**Message Queue: 10k+ Pending Messages:**
- Current capacity: Scheduler processes 15 messages per invocation. Database queries can handle 1000+ rows easily.
- Limit: Scheduler invocation frequency. If queue has 10k messages and each invocation takes 30s, clearing queue takes 200 invocations = >100 minutes.
- Scaling path: Increase batch size (but watch Green API rate limits). Parallelize multiple scheduler instances. Add priority queue (send ultimatum messages first).

**Supabase Auth: Multi-Tenant at Scale:**
- Current capacity: Auth via `user_events` junction table. No hard limits tested.
- Limit: Each login query joins `user_events` → `events` (line 280 in supabase.js). At 10k+ users, this join could be slow.
- Scaling path: Add index on `user_events(user_id, role)`. Cache user's event in session token (JWT custom claims). Or use Supabase organizations (when available).

## Dependencies at Risk

**GSAP (Greensock Animation Platform):**
- Risk: GSAP is used only in `RsvpForm.jsx` for scroll animations (lines 28-60). It's a heavy dependency (300KB+) for a non-critical feature.
- Impact: Larger bundle size. GSAP license requires attribution; ensure LICENSE file is present.
- Migration plan: Replace GSAP scroll animations with Intersection Observer + CSS transitions. This would eliminate the dependency and reduce bundle size by ~300KB.

**xlsx Library:**
- Risk: XLSX is used for Excel parsing/generation in guest upload. It's large (~600KB) but necessary for the feature.
- Impact: Bundle size impact. However, this is imported only in `src/lib/guest-excel.ts` (dynamic import possible).
- Migration plan: Consider lazy-loading XLSX only when user opens GuestUploadModal. Or use a lighter alternative (papaparse for CSV, xlsxPopulate for lighter Excel).

**Radix UI Dependencies:**
- Risk: Multiple `@radix-ui/*` packages (dialog, label, slot) are imported but may have versions that are outdated or have security patches.
- Impact: No known vulnerabilities currently. But updating should be tested in production-like environment.
- Migration plan: Keep Radix UI updated. Run `npm audit` monthly.

## Missing Critical Features

**Message Delivery Confirmation:**
- Problem: No webhook from Green API to confirm message was actually delivered to user's WhatsApp. Scheduler marks messages as "sent" immediately after API returns 200, but delivery can fail downstream.
- Blocks: Can't reliably report delivery status to admins. Can't differentiate between "sent but not delivered" and "fully delivered and read".
- Recommended feature: Implement `whatsapp-webhook/index.ts` (exists in codebase but may be incomplete) to listen for Green API delivery webhooks. Update `message_logs.status` to 'delivered' / 'read' when webhook arrives.

**Message Scheduling Precision:**
- Problem: `message_logs.scheduled_for` stores a timestamp, but the scheduler runs on ~5 minute intervals (or manual trigger). If a message is scheduled for 14:23:00, it might send at 14:25:00 or later.
- Blocks: Time-sensitive messages (e.g., "join our event in 1 hour") lack precision.
- Recommended feature: Implement job queuing with second-level precision (e.g., AWS EventBridge, Temporal, or PostgreSQL LISTEN).

**Bulk Message Manual Sending:**
- Problem: Dashboard supports selecting multiple guests, but there's no UI for "send custom message now" bulk action. Track B (manual custom messages) is mentioned in CLAUDE.md but not implemented.
- Blocks: Admins can't send targeted messages to subset of guests (e.g., "only pending guests").
- Recommended feature: Add BulkMessageModal to Dashboard that allows selecting a template or writing custom text, then queuing messages for the selected guests.

## Test Coverage Gaps

**Dashboard Guest Table:**
- What's not tested: Table rendering with various data states (empty, 1 guest, 100+ guests). Filter logic. Bulk selection. Message status badge click. Guest edit sheet save.
- Files: `src/pages/Dashboard.tsx` (no test file)
- Risk: Regressions in table rendering or filtering go unnoticed until manual testing.
- Priority: High — table is core admin feature.

**AutomationTimeline Stage Editing:**
- What's not tested: Stage modal open/close. Form validation. Save with network errors. Delete dynamic nudge. Toggle auto-pilot.
- Files: `src/components/dashboard/StageEditModal.tsx`, `src/pages/AutomationTimeline.tsx` (no test files)
- Risk: Stage editing bugs can break the entire automation funnel without being caught.
- Priority: High — automation is new and fragile.

**GuestUploadModal Multi-Step Flow:**
- What's not tested: File upload parsing. Validation errors. Upsert logic. Results display.
- Files: `src/components/dashboard/GuestUploadModal.tsx`, `src/lib/guest-excel.ts` (no test files)
- Risk: Upload flow can fail silently or show wrong results. Validation bypasses could insert bad data.
- Priority: High — data import is critical path.

**Supabase RPC Functions:**
- What's not tested: `update_whatsapp_template` whitelisting. `toggle_auto_pilot` idempotency. `delete_dynamic_nudge` guard logic (must not delete if messages exist).
- Files: Database migrations (no test files)
- Risk: Schema mutations can corrupt data if RPC logic is wrong.
- Priority: High — RPCs have SECURITY DEFINER and operate on critical data.

**WhatsApp Scheduler Operating Hours:**
- What's not tested: Time zone calculations. Shabbat window logic (Fri 14:00 cutoff, Sat 20:00 window). Edge cases at midnight.
- Files: `supabase/functions/whatsapp-scheduler/index.ts` (lines 56-79, no test)
- Risk: Messages sent outside operating hours or during Shabbat.
- Priority: Medium — affects user experience and religious observance.

---

*Concerns audit: 2026-03-03*
