import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Green API credentials — read per-request so a missing secret returns a
// structured 503 instead of crashing the Deno module at cold-start.
// ---------------------------------------------------------------------------

// (resolved inside the serve handler — see below)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageLog {
  id:            string;
  event_id:      string;
  invitation_id: string;
  phone:         string;
  message_type:  string;
  content:       string;
  scheduled_for: string | null;
}

// ---------------------------------------------------------------------------
// Phone number formatting
// ---------------------------------------------------------------------------

/**
 * Converts an Israeli phone number to the Green API chatId format.
 * Examples:
 *   "054-633-9018"  → "972546339018@c.us"
 *   "0546339018"    → "972546339018@c.us"
 *   "972546339018"  → "972546339018@c.us"   (already international)
 *   "+972546339018" → "972546339018@c.us"
 */
function formatIsraeliPhone(raw: string): string {
  const digits   = raw.replace(/\D/g, "");
  const national = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `${national}@c.us`;
}

// ---------------------------------------------------------------------------
// Operating hours gate — evaluated in Asia/Jerusalem timezone.
//
//  Sun–Thu  │ 09:00 – 20:59
//  Friday   │ 09:00 – 13:59  (Erev Shabbat cut-off at 14:00)
//  Saturday │ 20:00 – 20:59  (post-Shabbat window only)
// ---------------------------------------------------------------------------

function isWithinOperatingHours(): boolean {
  const now   = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday:  "short",
    hour:     "numeric",
    hour12:   false,
  }).formatToParts(now);

  const dayStr  = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value   ?? "0";

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const day  = dayMap[dayStr] ?? 0;
  const hour = parseInt(hourStr, 10) % 24; // guard: some engines emit "24" at midnight

  if (day === 6) return hour === 20;               // Saturday: 20:00–20:59 only
  if (day === 5) return hour >= 9 && hour <= 13;   // Friday:   09:00–13:59
  return hour >= 9 && hour <= 20;                  // Sun–Thu:  09:00–20:59
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

serve(async (req) => {
  console.log("--- [whatsapp-scheduler] Triggered ---");

  // Validate Green API credentials per-request so a missing secret produces a
  // structured error response rather than a cold-start module crash.
  const GREEN_API_INSTANCE_ID = Deno.env.get("GREEN_API_INSTANCE_ID");
  const GREEN_API_TOKEN       = Deno.env.get("GREEN_API_TOKEN");

  if (!GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) {
    const missing = [
      !GREEN_API_INSTANCE_ID && "GREEN_API_INSTANCE_ID",
      !GREEN_API_TOKEN       && "GREEN_API_TOKEN",
    ].filter(Boolean).join(", ");
    console.error(`[whatsapp-scheduler] Missing env vars: ${missing}`);
    return new Response(
      JSON.stringify({ error: "misconfigured", missing }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Optional body param: force_run=true bypasses the operating-hours gate
  let forceRun = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      forceRun = body.force_run === true;
    } catch {
      // No body or invalid JSON — proceed with defaults
    }
  }

  if (forceRun) {
    console.log("[whatsapp-scheduler] force_run=true — bypassing time/day restrictions.");
  } else if (!isWithinOperatingHours()) {
    console.log("[whatsapp-scheduler] Outside operating hours — skipping.");
    return new Response(
      JSON.stringify({ skipped: "outside_operating_hours" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Admin client — bypasses RLS so the function can read and update any row
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---------------------------------------------------------------------------
  // Step 1: Fetch up to 15 pending rows that are due
  //
  // Rows where scheduled_for IS NULL are treated as "send immediately" and are
  // ordered before any timestamp-scheduled rows.
  // ---------------------------------------------------------------------------

  const now = new Date().toISOString();

  const { data: logsData, error: fetchError } = await supabase
    .from("message_logs")
    .select("id, event_id, invitation_id, phone, message_type, content, scheduled_for")
    .eq("status", "pending")
    .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .limit(15);

  if (fetchError) {
    console.error("[whatsapp-scheduler] Failed to fetch message_logs:", fetchError.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch queue", message: fetchError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const logs = (logsData ?? []) as MessageLog[];

  if (logs.length === 0) {
    console.log("[whatsapp-scheduler] Queue is empty — nothing to process.");
    return new Response(
      JSON.stringify({ processed: 0, success: 0, failed: 0, queue: "empty" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  console.log(`[whatsapp-scheduler] Processing ${logs.length} message(s).`);

  // ---------------------------------------------------------------------------
  // Step 2: Process each row — send via Green API, then update status
  // ---------------------------------------------------------------------------

  const greenApiBase =
    `https://api.greenapi.com/waInstance${GREEN_API_INSTANCE_ID}/sendMessage/${GREEN_API_TOKEN}`;

  let success = 0;
  let failed  = 0;

  for (const log of logs) {
    const chatId = formatIsraeliPhone(log.phone);

    console.log(
      `[whatsapp-scheduler] → id=${log.id} | type=${log.message_type} | chatId=${chatId}`,
    );

    try {
      const res = await fetch(greenApiBase, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ chatId, message: log.content }),
      });

      const responseText = await res.text();
      console.log(
        `[whatsapp-scheduler] Green API → status=${res.status} | body=${responseText}`,
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} — ${responseText}`);
      }

      // Mark as sent
      const { error: updateError } = await supabase
        .from("message_logs")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", log.id);

      if (updateError) {
        // Message was delivered but our DB update failed — log and continue
        console.error(
          `[whatsapp-scheduler] Sent but failed to update row ${log.id}:`,
          updateError.message,
        );
      }

      success++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[whatsapp-scheduler] FAILED id=${log.id} chatId=${chatId}:`, errMsg);

      // Mark as failed and record the error details
      const { error: updateError } = await supabase
        .from("message_logs")
        .update({ status: "failed", error_log: errMsg })
        .eq("id", log.id);

      if (updateError) {
        console.error(
          `[whatsapp-scheduler] Also failed to update row ${log.id} to 'failed':`,
          updateError.message,
        );
      }

      failed++;
    }
  }

  const processed = success + failed;
  console.log(
    `[whatsapp-scheduler] Done — processed: ${processed} | success: ${success} | failed: ${failed}`,
  );

  return new Response(
    JSON.stringify({ processed, success, failed }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
