import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ---------------------------------------------------------------------------
// ⚠  PAUSED — intentionally disconnected from the Green API dashboard.
//    DO NOT connect until a dedicated operational phone number is confirmed.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Green API credentials — loaded once at cold start, fail fast if missing
// ---------------------------------------------------------------------------

const GREEN_API_ID_INSTANCE = Deno.env.get("GREEN_API_ID_INSTANCE");
const GREEN_API_TOKEN_INSTANCE = Deno.env.get("GREEN_API_TOKEN_INSTANCE");

if (!GREEN_API_ID_INSTANCE || !GREEN_API_TOKEN_INSTANCE) {
  throw new Error(
    "[whatsapp-webhook] Missing required env vars: GREEN_API_ID_INSTANCE and/or GREEN_API_TOKEN_INSTANCE",
  );
}

// ---------------------------------------------------------------------------
// Auto-reply message (hardcoded for now — will move to events.automation_config)
// ---------------------------------------------------------------------------

const AUTO_REPLY_TEXT =
  "היי! זו הודעה אוטומטית ממערכת אישורי ההגעה. כדי שהזוג יידע שאתם מגיעים, אנא היכנסו לקישור שבהודעה המקורית ועדכנו שם. נתראה בשמחות! 🥂";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Always return 200 so Green API never retries the delivery. */
function ok(): Response {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

serve(async (req) => {
  console.log("--- [whatsapp-webhook] Triggered ---");

  // --- Parse body ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    console.warn("[whatsapp-webhook] Non-JSON body received — ignoring.");
    return ok();
  }

  const typeWebhook = typeof body.typeWebhook === "string"
    ? body.typeWebhook
    : "";

  console.log(`[whatsapp-webhook] typeWebhook=${typeWebhook}`);

  // --- Only handle message and call events ---
  const HANDLED_TYPES = ["incomingMessageReceived", "incomingCall"];
  if (!HANDLED_TYPES.includes(typeWebhook)) {
    console.log(`[whatsapp-webhook] Ignored webhook type: "${typeWebhook}"`);
    return ok();
  }

  // --- Extract chatId from senderData ---
  const senderData = body.senderData as Record<string, unknown> | undefined;
  const chatId = typeof senderData?.chatId === "string"
    ? senderData.chatId
    : null;

  if (!chatId) {
    console.warn(
      "[whatsapp-webhook] No chatId found in senderData — ignoring.",
    );
    return ok();
  }

  // --- Private chats only (skip @g.us groups) ---
  if (!chatId.endsWith("@c.us")) {
    console.log(
      `[whatsapp-webhook] Skipping non-private chatId: ${chatId}`,
    );
    return ok();
  }

  // --- Send auto-reply ---
  console.log(`[whatsapp-webhook] Sending auto-reply to ${chatId}`);

  try {
    const url =
      `https://api.greenapi.com/waInstance${GREEN_API_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN_INSTANCE}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message: AUTO_REPLY_TEXT }),
    });

    const responseText = await res.text();
    console.log(
      `[whatsapp-webhook] Green API response → status: ${res.status} | body: ${responseText}`,
    );
  } catch (err) {
    // Log but never let a send failure affect the 200 we must return to Green API
    console.error(
      "[whatsapp-webhook] Failed to send auto-reply:",
      (err as Error)?.message,
    );
  }

  return ok();
});
