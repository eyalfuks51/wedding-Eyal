import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. RSVP functionality will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const fetchEventBySlug = async (slug) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, template_id, content_config')
    .eq('slug', slug)
    .single();
  if (error) throw error;
  return data;
};

export const submitRsvp = async (rsvpData, eventId) => {
  if (!supabase) {
    console.error('Supabase is not configured');
    throw new Error('שירות האישורים אינו זמין כרגע');
  }

  const phone = rsvpData.phone;
  const rsvpStatus = rsvpData.attending ? 'attending' : 'declined';
  const confirmedPax = rsvpData.attending ? parseInt(rsvpData.guest_count, 10) : 0;

  // --- invitations table: lookup by phone in the array, then update or insert ---
  const { data: matches, error: lookupError } = await supabase
    .from('invitations')
    .select('id')
    .eq('event_id', eventId)
    .contains('phone_numbers', [phone]);

  if (lookupError) {
    console.error('Error looking up invitation:', lookupError);
    throw new Error('אירעה שגיאה בשליחת האישור. אנא נסו שוב.');
  }

  if (matches && matches.length > 0) {
    // Known guest — update existing row
    const { error: updateError } = await supabase
      .from('invitations')
      .update({ rsvp_status: rsvpStatus, confirmed_pax: confirmedPax })
      .eq('id', matches[0].id);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      throw new Error('אירעה שגיאה בשליחת האישור. אנא נסו שוב.');
    }
  } else {
    // Unknown number — create a new row
    const { error: insertError } = await supabase
      .from('invitations')
      .insert([{
        event_id: eventId,
        group_name: rsvpData.name,
        phone_numbers: [phone],
        is_automated: false,
        rsvp_status: rsvpStatus,
        confirmed_pax: confirmedPax,
      }]);

    if (insertError) {
      console.error('Error inserting invitation:', insertError);
      throw new Error('אירעה שגיאה בשליחת האישור. אנא נסו שוב.');
    }
  }

  // --- arrival_permits upsert — triggers the Google Sheets webhook (keep intact) ---
  const { error: permitError } = await supabase
    .from('arrival_permits')
    .upsert([{
      event_id: eventId,
      full_name: rsvpData.name,
      phone,
      attending: rsvpData.attending,
      guests_count: rsvpData.guest_count,
      needs_parking: rsvpData.needs_parking,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'event_id,phone' });

  if (permitError) {
    // Log but don't surface to the user — the primary RSVP already succeeded
    console.error('Error syncing to arrival_permits (Google Sheets webhook):', permitError);
  }
};

export const fetchAllGuests = async () => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('arrival_permits')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error('שגיאה בטעינת רשימת האורחים');
  return data;
};
