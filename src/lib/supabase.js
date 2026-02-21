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

  const { data, error } = await supabase
    .from('arrival_permits')
    .upsert([{
      event_id: eventId,
      full_name: rsvpData.name,
      phone: rsvpData.phone,
      attending: rsvpData.attending,
      guests_count: rsvpData.guest_count,
      needs_parking: rsvpData.needs_parking,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'event_id,phone' })
    .select();

  if (error) {
    console.error('Error submitting RSVP:', error);
    throw new Error('אירעה שגיאה בשליחת האישור. אנא נסו שוב.');
  }

  return data;
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
