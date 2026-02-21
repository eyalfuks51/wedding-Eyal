import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleAuth } from "npm:google-auth-library@10.3.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")!.replace(/\\n/g, "\n");

serve(async (req) => {
  console.log("--- [sync-to-sheets] Webhook triggered! ---");
  console.log("[sync-to-sheets] Request method:", req.method);
  console.log("[sync-to-sheets] Request URL:", req.url);

  try {
    // Step 1: Parse incoming payload
    const body = await req.json();
    console.log("[sync-to-sheets] Raw incoming payload:", JSON.stringify(body, null, 2));

    const { type, record } = body;
    console.log("[sync-to-sheets] Event type:", type);
    console.log("[sync-to-sheets] Record:", JSON.stringify(record, null, 2));
    console.log("[sync-to-sheets] event_id from record:", record?.event_id);

    if (type !== "INSERT" && type !== "UPDATE") {
      console.log("[sync-to-sheets] Ignoring event type:", type);
      return new Response(JSON.stringify({ message: "Ignored event type" }), { status: 200 });
    }

    // Step 2: Query Supabase for the google_sheet_id
    console.log("[sync-to-sheets] Initializing Supabase client...");
    console.log("[sync-to-sheets] SUPABASE_URL present:", !!Deno.env.get("SUPABASE_URL"));
    console.log("[sync-to-sheets] SUPABASE_SERVICE_ROLE_KEY present:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[sync-to-sheets] Querying events table for event_id: ${record.event_id}`);
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("google_sheet_id")
      .eq("id", record.event_id)
      .single();

    console.log("[sync-to-sheets] Supabase query result - data:", JSON.stringify(event, null, 2));
    console.log("[sync-to-sheets] Supabase query result - error:", JSON.stringify(eventError, null, 2));

    if (eventError || !event?.google_sheet_id) {
      const msg = `Could not find google_sheet_id for event_id: ${record.event_id}`;
      console.error("[sync-to-sheets] ERROR:", msg);
      throw new Error(msg);
    }

    const spreadsheetId = event.google_sheet_id;
    console.log("[sync-to-sheets] Resolved google_sheet_id:", spreadsheetId);

    // Step 3: Google Auth
    console.log("[sync-to-sheets] Initializing GoogleAuth...");
    console.log("[sync-to-sheets] GOOGLE_SERVICE_ACCOUNT_EMAIL present:", !!serviceAccountEmail);
    console.log("[sync-to-sheets] GOOGLE_PRIVATE_KEY present:", !!privateKey);

    const auth = new GoogleAuth({
      credentials: { client_email: serviceAccountEmail, private_key: privateKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    console.log("[sync-to-sheets] GoogleAuth initialized. Fetching access token...");
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const token = accessToken.token;
    console.log("[sync-to-sheets] Access token retrieved successfully. Token present:", !!token);

    // Step 4: Dynamically fetch the first sheet's name from spreadsheet metadata
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    console.log("[sync-to-sheets] Fetching spreadsheet metadata from:", metaUrl);

    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("[sync-to-sheets] Metadata response status:", metaRes.status);

    const metaData = await metaRes.json();
    console.log("[sync-to-sheets] Metadata response body:", JSON.stringify(metaData, null, 2));

    if (!metaRes.ok || !metaData?.sheets?.length) {
      throw new Error(`Failed to fetch spreadsheet metadata. Status: ${metaRes.status}. Body: ${JSON.stringify(metaData)}`);
    }

    const sheetName = metaData.sheets[0].properties.title;
    console.log("[sync-to-sheets] Resolved first sheet name:", sheetName);

    // Step 5: Build row values
    const values = [[
      record.full_name,
      record.phone,
      record.attending,
      record.guests_count,
      record.needs_parking,
    ]];
    console.log("[sync-to-sheets] Row values to write:", JSON.stringify(values));

    // Step 6: GET — read column B to find existing phone
    const encodedSheetName = encodeURIComponent(sheetName);
    console.log("[sync-to-sheets] Using dynamic sheet name in URL:", sheetName, "| encoded:", encodedSheetName);
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheetName}!B:B`;
    console.log("[sync-to-sheets] GET request URL:", getUrl);

    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("[sync-to-sheets] GET response status:", getRes.status);

    const getData = await getRes.json();
    console.log("[sync-to-sheets] GET response body:", JSON.stringify(getData, null, 2));

    const phoneNumbers = getData.values ? getData.values.map((row: string[]) => row[0]) : [];
    console.log("[sync-to-sheets] Existing phone numbers in sheet:", JSON.stringify(phoneNumbers));

    const rowIndex = phoneNumbers.indexOf(record.phone);
    console.log(`[sync-to-sheets] Searching for phone "${record.phone}" — found at index: ${rowIndex} (${rowIndex === -1 ? "not found, will append" : `row ${rowIndex + 1}, will update`})`);

    if (rowIndex !== -1) {
      // Step 7a: PUT — update existing row
      const rowNumber = rowIndex + 1;
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheetName}!A${rowNumber}:E${rowNumber}?valueInputOption=RAW`;
      const updatePayload = JSON.stringify({ values });
      console.log("[sync-to-sheets] PUT request URL:", updateUrl);
      console.log("[sync-to-sheets] PUT request payload:", updatePayload);

      const updateRes = await fetch(updateUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: updatePayload,
      });
      const updateData = await updateRes.json();
      console.log("[sync-to-sheets] PUT response status:", updateRes.status);
      console.log("[sync-to-sheets] PUT response body:", JSON.stringify(updateData, null, 2));
    } else {
      // Step 7b: POST — append new row
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheetName}!A:E:append?valueInputOption=RAW`;
      const appendPayload = JSON.stringify({ values });
      console.log("[sync-to-sheets] POST request URL:", appendUrl);
      console.log("[sync-to-sheets] POST request payload:", appendPayload);

      const appendRes = await fetch(appendUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: appendPayload,
      });
      const appendData = await appendRes.json();
      console.log("[sync-to-sheets] POST response status:", appendRes.status);
      console.log("[sync-to-sheets] POST response body:", JSON.stringify(appendData, null, 2));
    }

    console.log("[sync-to-sheets] SUCCESS. Sync complete.");
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[sync-to-sheets] CAUGHT ERROR:");
    console.error("[sync-to-sheets] error.message:", error?.message);
    console.error("[sync-to-sheets] error.name:", error?.name);
    console.error("[sync-to-sheets] error.stack:", error?.stack);
    console.error("[sync-to-sheets] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));

    return new Response(
      JSON.stringify({ error: "Internal server error", message: error?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
