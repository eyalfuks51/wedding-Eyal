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
    .select('id, slug, template_id, content_config, event_date, automation_config')
    .eq('slug', slug)
    .single();
  if (error) throw error;
  return data;
};

/** Fetch all automation_settings rows for an event, ordered by days_before DESC */
export const fetchAutomationSettings = async (eventId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('automation_settings')
    .select('id, event_id, stage_name, days_before, target_status, is_active, created_at')
    .eq('event_id', eventId)
    .order('days_before', { ascending: false });
  if (error) throw error;
  return data;
};

/** Update a single automation_settings row (toggle is_active, change days_before) */
export const updateAutomationSetting = async (settingId, updates) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('automation_settings')
    .update(updates)
    .eq('id', settingId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * Atomically patch a single whatsapp_template stage via Postgres RPC.
 * Uses jsonb_set server-side — no race conditions, no broad UPDATE on events.
 */
export const updateWhatsAppTemplate = async (eventId, stageName, singular, plural) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('update_whatsapp_template', {
    p_event_id:   eventId,
    p_stage_name: stageName,
    p_singular:   singular,
    p_plural:     plural,
  });
  if (error) throw error;
};

/**
 * Fetch aggregate message stats grouped by message_type for a given event.
 * Returns: { [message_type]: { sent: number, pending: number, failed: number } }
 */
export const fetchMessageStatsPerStage = async (eventId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('message_logs')
    .select('message_type, status')
    .eq('event_id', eventId);
  if (error) throw error;

  const stats = {};
  for (const row of data ?? []) {
    if (!stats[row.message_type]) {
      stats[row.message_type] = { sent: 0, pending: 0, failed: 0 };
    }
    if (row.status === 'sent')         stats[row.message_type].sent++;
    else if (row.status === 'pending') stats[row.message_type].pending++;
    else if (row.status === 'failed')  stats[row.message_type].failed++;
  }
  return stats;
};

export const submitRsvp = async (rsvpData, eventId) => {
  if (!supabase) {
    console.error('Supabase is not configured');
    throw new Error('שירות האישורים אינו זמין כרגע');
  }

  // Single write to arrival_permits. A DB trigger propagates the change to invitations.
  const { error } = await supabase
    .from('arrival_permits')
    .upsert([{
      event_id:      eventId,
      full_name:     rsvpData.name,
      phone:         rsvpData.phone,
      attending:     rsvpData.attending,
      guests_count:  rsvpData.guest_count,
      needs_parking: rsvpData.needs_parking,
      updated_at:    new Date().toISOString(),
    }], { onConflict: 'event_id,phone' });

  if (error) {
    console.error('Error upserting arrival_permits:', error);
    throw new Error('אירעה שגיאה בשליחת האישור. אנא נסו שוב.');
  }
};
