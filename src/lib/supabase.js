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
 * Update the full content_config JSONB for an event.
 * Merges the provided config with the existing one (shallow merge at top level).
 * whatsapp_templates are excluded — those are managed via the Timeline's StageEditModal.
 */
export const updateEventContentConfig = async (eventId, contentConfig) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase
    .from('events')
    .update({ content_config: contentConfig })
    .eq('id', eventId);
  if (error) throw error;
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

/** Count automated invitations grouped by rsvp_status for an event */
export const fetchAutomatedAudienceCounts = async (eventId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('invitations')
    .select('rsvp_status')
    .eq('event_id', eventId)
    .eq('is_automated', true);
  if (error) throw error;

  const counts = { pending: 0, attending: 0 };
  for (const row of data ?? []) {
    if (row.rsvp_status === 'pending') counts.pending++;
    else if (row.rsvp_status === 'attending') counts.attending++;
  }
  return counts;
};

/**
 * Fetch all message_logs for a given stage, joined with invitations.group_name.
 * Uses the FK relationship message_logs.invitation_id → invitations.id.
 * Ordered newest-first.
 */
export const fetchStageMessageLogs = async (eventId, stageName) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('message_logs')
    .select('id, invitation_id, phone, status, error_log, sent_at, scheduled_for, created_at, invitations(group_name)')
    .eq('event_id', eventId)
    .eq('message_type', stageName)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

/** Toggle the event-level Auto-Pilot flag via RPC */
export const toggleAutoPilot = async (eventId, enabled) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('toggle_auto_pilot', {
    p_event_id: eventId,
    p_enabled:  enabled,
  });
  if (error) throw error;
};

/** Insert a new dynamic nudge stage */
export const addDynamicNudge = async (eventId, stageName, daysBefore) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('automation_settings')
    .insert({ event_id: eventId, stage_name: stageName, days_before: daysBefore, target_status: 'pending', is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Delete a dynamic nudge via the guarded RPC (fails if messages exist) */
export const deleteDynamicNudge = async (settingId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('delete_dynamic_nudge', {
    p_setting_id: settingId,
  });
  if (error) throw error;
};

/**
 * Bulk upsert invitations by primary phone number.
 * For each guest: if an invitation with the same phone_numbers[0] exists → update,
 * otherwise → insert. Returns { inserted, updated, errors[] }.
 */
export const bulkUpsertInvitations = async (eventId, guests) => {
  if (!supabase) throw new Error('Supabase is not configured');

  // Fetch existing invitations to find matches by primary phone
  const { data: existing, error: fetchErr } = await supabase
    .from('invitations')
    .select('id, phone_numbers')
    .eq('event_id', eventId);
  if (fetchErr) throw fetchErr;

  // Build a map: normalized primary phone → invitation id
  const phoneToId = new Map();
  for (const inv of existing ?? []) {
    const primary = inv.phone_numbers?.[0];
    if (primary) phoneToId.set(primary, inv.id);
  }

  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (const guest of guests) {
    const primaryPhone = guest.phone_numbers[0] ?? null;
    const existingId = primaryPhone ? phoneToId.get(primaryPhone) : undefined;
    const dbGroupName = guest.group_name?.trim() || '';

    try {
      if (existingId) {
        // UPDATE — preserve rsvp_status, confirmed_pax, messages_sent_count
        const { error } = await supabase
          .from('invitations')
          .update({
            group_name: dbGroupName,
            phone_numbers: guest.phone_numbers,
            invited_pax: guest.invited_pax,
            side: guest.side,
            guest_group: guest.guest_group,
            is_automated: guest.is_automated,
          })
          .eq('id', existingId);
        if (error) throw error;
        updated++;
      } else {
        // INSERT
        const { error } = await supabase
          .from('invitations')
          .insert({
            event_id: eventId,
            group_name: dbGroupName,
            phone_numbers: guest.phone_numbers,
            invited_pax: guest.invited_pax,
            confirmed_pax: 0,
            rsvp_status: 'pending',
            is_automated: guest.is_automated,
            messages_sent_count: 0,
            side: guest.side,
            guest_group: guest.guest_group,
          });
        if (error) throw error;
        inserted++;
      }
    } catch (err) {
      errors.push({
        group_name: dbGroupName || 'ללא שם',
        phone: primaryPhone || '',
        error: err.message || 'שגיאה לא ידועה',
      });
    }
  }

  return { inserted, updated, errors };
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
    }], { onConflict: 'event_id,phone' });

  if (error) {
    console.error('Error upserting arrival_permits:', error);
    throw new Error('אירעה שגיאה בשליחת האישור. אנא נסו שוב.');
  }
};

/**
 * Fetch all events for the currently authenticated user via user_events join.
 * Returns an array sorted by event_date DESC (newest first).
 * Returns [] for users with no events.
 */
export const fetchEventsForUser = async () => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('user_events')
    .select('events(id, slug, template_id, content_config, event_date, automation_config, status, partner1_name, partner2_name)');
  if (error) throw error;
  const results = (data ?? []).map(row => row.events).filter(Boolean);
  // Sort client-side: avoids Supabase foreignTable ordering pitfall
  return results.sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''));
};

/**
 * Fetch ALL events — for super admins only.
 * Regular users will get an empty array (RLS blocks access without the super admin policy).
 * Returns array sorted by event_date DESC.
 */
export const fetchAllEvents = async () => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, template_id, content_config, event_date, automation_config, status, partner1_name, partner2_name')
    .order('event_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

/**
 * Fetch the event linked to the currently authenticated user.
 * Returns null if the user has no event yet (new user → show onboarding).
 */
export const fetchEventForUser = async () => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('user_events')
    .select('role, events(id, slug, template_id, content_config, event_date, automation_config, status)')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.events ?? null;
};

/**
 * Generate a URL-safe slug from two partner names.
 * Preserves Hebrew characters, Latin letters, digits, and hyphens.
 * Appends a 6-char random suffix for uniqueness.
 * The UNIQUE constraint on events.slug handles any (extremely rare) collision.
 */
export function generateSlug(p1, p2) {
  const base = `${p1}-and-${p2}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0590-\u05ff-]/g, '') // Keep Hebrew + Latin + digits + hyphens
    .replace(/-+/g, '-')     // Collapse multiple hyphens
    .replace(/^-|-$/g, '')   // Trim leading/trailing hyphens
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `event-${suffix}`;
}

/**
 * Create a new draft event and link it to the currently authenticated user.
 * Called at the end of the onboarding wizard.
 */
export const createOnboardingEvent = async ({ slug, templateId, contentConfig, partner1Name, partner2Name, eventDate }) => {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.rpc('create_onboarding_event', {
    p_slug: slug,
    p_template_id: templateId,
    p_content_config: contentConfig,
    p_partner1_name: partner1Name || null,
    p_partner2_name: partner2Name || null,
    p_event_date: eventDate || null,
  });
  if (error) throw error;

  return data;
};

/**
 * Fetch all arrival_permits for an event that have not yet been matched to an invitation.
 * Returns the full row for each unmatched permit, ordered newest-first.
 * @param {string} eventId - UUID of the event
 * @returns {Promise<Array>} Array of unmatched arrival_permit rows
 */
export const fetchUnmatchedPermits = async (eventId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('arrival_permits')
    .select('*')
    .eq('event_id', eventId)
    .eq('match_status', 'unmatched')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

/**
 * Link an existing arrival_permit to an existing invitation via RPC.
 * The RPC handles updating match_status and syncing RSVP data.
 * @param {number} permitId - PK of the arrival_permit row
 * @param {string} invitationId - UUID of the target invitation
 * @returns {Promise<void>}
 */
export const linkPermitToInvitation = async (permitId, invitationId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('link_permit_to_invitation', {
    p_permit_id: permitId,
    p_invitation_id: invitationId,
  });
  if (error) throw error;
};

/**
 * Create a new invitation record from an unmatched arrival_permit via RPC.
 * The RPC inserts the invitation, links the permit, and returns the new invitation UUID.
 * @param {number} permitId - PK of the arrival_permit row
 * @returns {Promise<string>} UUID of the newly created invitation
 */
export const createInvitationFromPermit = async (permitId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.rpc('create_invitation_from_permit', {
    p_permit_id: permitId,
  });
  if (error) throw error;
  return data;
};
