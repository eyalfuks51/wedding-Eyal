import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Green API credentials — loaded once at cold start, fail fast if missing
// ---------------------------------------------------------------------------

const GREEN_API_ID_INSTANCE = Deno.env.get("GREEN_API_ID_INSTANCE");
const GREEN_API_TOKEN_INSTANCE = Deno.env.get("GREEN_API_TOKEN_INSTANCE");

if (!GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN_INSTANCE) {
  throw new Error(
    "[whatsapp-scheduler] Missing required env vars: GREEN_API_ID_INSTANCE and/or GREEN_API_TOKEN_INSTANCE",
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutomationConfig {
  reminders_enabled: boolean;
  max_reminders: number;        // absolute cap per invitation
  days_between_reminders: number;
  message_template?: string;    // supports {group_name} placeholder
}

interface Event {
  id: string;
  slug: string;
  automation_config: AutomationConfig;
}

interface Invitation {
  id: string;
  group_name: string;
  phone_numbers: string[];
  messages_sent_count: number | null;
  last_message_sent_at: string | null;
}

interface EventSummary {
  dispatched: number;
  skipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Phone number formatting
// ---------------------------------------------------------------------------

/**
 * Converts an Israeli local number to the Green API chatId format.
 * Examples:
 *   "054-633-9018"  → "972546339018@c.us"
 *   "0546339018"    → "972546339018@c.us"
 *   "972546339018"  → "972546339018@c.us"  (already international — left as-is)
 */
function formatIsraeliPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `${national}@c.us`;
}

// ---------------------------------------------------------------------------
// WhatsApp dispatch via Green API
// ---------------------------------------------------------------------------

async function dispatchWhatsApp(
  phone: string,
  groupName: string,
  messageTemplate: string,
): Promise<void> {
  const message = messageTemplate.replace(/{group_name}/g, groupName);
  const chatId = formatIsraeliPhone(phone);

  console.log(
    `[whatsapp-scheduler] DISPATCH → chatId: ${chatId} | message: "${message}"`,
  );

  const url =
    `https://api.greenapi.com/waInstance${GREEN_API_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN_INSTANCE}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });

  const responseText = await res.text();
  console.log(
    `[whatsapp-scheduler] Green API response → status: ${res.status} | body: ${responseText}`,
  );

  if (!res.ok) {
    throw new Error(
      `Green API error for ${chatId}: HTTP ${res.status} — ${responseText}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Operating hours check — always evaluated in Asia/Jerusalem timezone.
//
//  Sun–Thu  │ 09:00 – 20:59  (base rule)
//  Friday   │ 09:00 – 13:59  (Erev Shabbat cut-off at 14:00)
//  Saturday │ 20:00 – 20:59  (post-Shabbat window only)
// ---------------------------------------------------------------------------

function isWithinOperatingHours(): boolean {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);

  const dayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const day = dayMap[dayStr] ?? 0;
  const hour = parseInt(hourStr, 10) % 24; // guard: some engines emit "24" at midnight

  if (day === 6) {
    // Saturday (Shabbat): only the narrow post-Shabbat window
    return hour === 20; // 20:00–20:59
  }
  if (day === 5) {
    // Friday (Erev Shabbat): block from 14:00 onwards
    return hour >= 9 && hour <= 13; // 09:00–13:59
  }
  // Sunday–Thursday: base window
  return hour >= 9 && hour <= 20; // 09:00–20:59
}

function isCooledDown(
  lastSentAt: string | null,
  daysBetween: number,
): boolean {
  if (lastSentAt === null) return true; // never sent → always eligible
  const cooldownMs = daysBetween * 24 * 60 * 60 * 1000;
  return Date.now() >= new Date(lastSentAt).getTime() + cooldownMs;
}

function hoursUntilEligible(lastSentAt: string, daysBetween: number): number {
  const cooldownMs = daysBetween * 24 * 60 * 60 * 1000;
  const eligibleAt = new Date(lastSentAt).getTime() + cooldownMs;
  return Math.ceil((eligibleAt - Date.now()) / (1000 * 60 * 60));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

serve(async (req) => {
  console.log("--- [whatsapp-scheduler] Triggered ---");
  console.log("[whatsapp-scheduler] Method:", req.method);

  // --- Parse optional body params ---
  let eventIdFilter: string | null = null;
  let forceRun = false;

  if (req.method === "POST") {
    try {
      const body = await req.json();
      eventIdFilter = typeof body.event_id === "string" ? body.event_id : null;
      forceRun = body.force_run === true;
    } catch {
      // No body or invalid JSON — proceed with defaults
    }
  }

  console.log(
    `[whatsapp-scheduler] eventIdFilter=${eventIdFilter ?? "ALL"} | forceRun=${forceRun}`,
  );

  // --- Operating hours gate ---
  if (forceRun) {
    console.log(
      "[whatsapp-scheduler] force_run=true — bypassing time/day restrictions.",
    );
  } else if (!isWithinOperatingHours()) {
    console.log(
      "[whatsapp-scheduler] Outside operating hours (Shabbat/Night) - sleeping",
    );
    return new Response(
      JSON.stringify({ success: true, skipped: "outside_operating_hours" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // -------------------------------------------------------------------------
    // Step 1: Fetch events that have reminders_enabled = true
    // -------------------------------------------------------------------------
    let eventsQuery = supabase
      .from("events")
      .select("id, slug, automation_config")
      // JSONB text extraction: automation_config->>'reminders_enabled' = 'true'
      .filter("automation_config->>reminders_enabled", "eq", "true");

    if (eventIdFilter) {
      eventsQuery = eventsQuery.eq("id", eventIdFilter);
    }

    const { data: eventsData, error: eventsError } = await eventsQuery;

    if (eventsError) {
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }

    const events = (eventsData ?? []) as Event[];

    if (events.length === 0) {
      console.log(
        "[whatsapp-scheduler] No events with reminders_enabled=true found.",
      );
      return new Response(
        JSON.stringify({ success: true, processed: 0, summary: {} }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[whatsapp-scheduler] Found ${events.length} event(s) to process.`,
    );

    const summary: Record<string, EventSummary> = {};

    // -------------------------------------------------------------------------
    // Step 2: Process each event
    // -------------------------------------------------------------------------
    for (const event of events) {
      const config = event.automation_config;
      const maxReminders = config.max_reminders ?? 3;
      const daysBetween = config.days_between_reminders ?? 3;
      const messageTemplate =
        config.message_template ??
        "שלום {group_name}! אנחנו מזכירים לכם לאשר הגעה לחתונה שלנו 💌";

      console.log(
        `[whatsapp-scheduler] → Event: ${event.slug} (${event.id}) | cap=${maxReminders} | cooldown=${daysBetween}d`,
      );

      // Fetch pending, automated invitations that are still under the cap.
      // messages_sent_count may be NULL on fresh rows — treat NULL as 0.
      const { data: invData, error: invError } = await supabase
        .from("invitations")
        .select(
          "id, group_name, phone_numbers, messages_sent_count, last_message_sent_at",
        )
        .eq("event_id", event.id)
        .eq("rsvp_status", "pending")
        .eq("is_automated", true)
        .or(
          `messages_sent_count.is.null,messages_sent_count.lt.${maxReminders}`,
        );

      if (invError) {
        console.error(
          `[whatsapp-scheduler] Error fetching invitations for event ${event.id}:`,
          invError.message,
        );
        summary[event.slug] = { dispatched: 0, skipped: 0, errors: 1 };
        continue;
      }

      const invitations = (invData ?? []) as Invitation[];
      console.log(
        `[whatsapp-scheduler] Event ${event.slug}: ${invitations.length} invitation(s) under the ${maxReminders}-message cap.`,
      );

      let dispatched = 0;
      let skipped = 0;
      let errors = 0;

      // -----------------------------------------------------------------------
      // Step 3–5: Per-invitation loop
      // -----------------------------------------------------------------------
      for (const invitation of invitations) {
        const sentCount = invitation.messages_sent_count ?? 0;

        // Step 3: Cooldown check (skipped when force_run=true)
        if (!forceRun && !isCooledDown(invitation.last_message_sent_at, daysBetween)) {
          const hours = hoursUntilEligible(
            invitation.last_message_sent_at!,
            daysBetween,
          );
          console.log(
            `[whatsapp-scheduler] SKIP invitation ${invitation.id} (${invitation.group_name}): cooldown active — ${hours}h remaining.`,
          );
          skipped++;
          continue;
        }

        const phones = invitation.phone_numbers ?? [];
        if (phones.length === 0) {
          console.warn(
            `[whatsapp-scheduler] SKIP invitation ${invitation.id} (${invitation.group_name}): phone_numbers array is empty.`,
          );
          skipped++;
          continue;
        }

        // Step 4: Dispatch to EVERY number in the array
        let dispatchFailed = false;
        for (const phone of phones) {
          try {
            await dispatchWhatsApp(phone, invitation.group_name, messageTemplate);
          } catch (dispatchErr) {
            console.error(
              `[whatsapp-scheduler] Dispatch error for phone ${phone} (invitation ${invitation.id}):`,
              dispatchErr?.message,
            );
            dispatchFailed = true;
          }
        }

        if (dispatchFailed) {
          errors++;
          continue; // don't update the record if dispatch blew up
        }

        // Step 5: Single update — increment count + timestamp
        const { error: updateError } = await supabase
          .from("invitations")
          .update({
            messages_sent_count: sentCount + 1,
            last_message_sent_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);

        if (updateError) {
          console.error(
            `[whatsapp-scheduler] Failed to update invitation ${invitation.id}:`,
            updateError.message,
          );
          errors++;
        } else {
          console.log(
            `[whatsapp-scheduler] Updated invitation ${invitation.id} (${invitation.group_name}): messages_sent_count → ${sentCount + 1}`,
          );
          dispatched++;
        }
      }

      summary[event.slug] = { dispatched, skipped, errors };
      console.log(
        `[whatsapp-scheduler] Event ${event.slug} complete — dispatched: ${dispatched} | skipped: ${skipped} | errors: ${errors}`,
      );
    }

    console.log("[whatsapp-scheduler] All events processed.", summary);

    return new Response(
      JSON.stringify({ success: true, summary }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[whatsapp-scheduler] FATAL ERROR:", error?.message);
    console.error("[whatsapp-scheduler] Stack:", error?.stack);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error?.message ?? "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
