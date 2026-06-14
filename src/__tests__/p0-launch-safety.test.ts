/**
 * P0 launch-safety verification harness.
 *
 * Loads the THREE real P0 migration files into an in-process Postgres (PGlite)
 * on top of a minimal model of the production schema, then proves the security
 * properties the migrations are supposed to guarantee:
 *
 *   B. arrival_permits RLS + submit_rsvp public path
 *   C. RPC EXECUTE revocation + ownership guards
 *   D. WhatsApp queue atomic claim (no duplicate claim across overlapping runs)
 *
 * Why PGlite and not the live DB: the slice may NOT apply migrations to the
 * production database, so the *post-migration* state can only be proven in a
 * disposable sandbox. The migration SQL executed here is byte-for-byte the same
 * file that will later be applied to prod (read from supabase/migrations/).
 *
 * KNOWN LIMITATION (reported honestly): PGlite is a single-connection embedded
 * Postgres, so it cannot host two genuinely simultaneous transactions. The
 * `FOR UPDATE SKIP LOCKED` instant-collision path therefore cannot be exercised
 * here. What IS proven is the property that actually prevents duplicate sends in
 * this system: the atomic status flip pending -> processing means a row claimed
 * by one run is invisible to any later/overlapping run's claim. SKIP LOCKED is
 * the standard Postgres primitive covering the rarer same-instant case.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.resolve(here, '../../supabase/migrations');
const mig = (f: string) => readFileSync(path.join(migDir, f), 'utf8');

const MIG_A = '20260614120000_arrival_permits_rls_hardening.sql';
const MIG_B = '20260614120100_rpc_revoke_anon_and_ownership.sql';
const MIG_C = '20260614120200_whatsapp_atomic_claim.sql';

// Fixed UUIDs for deterministic tests
const U1 = '11111111-1111-1111-1111-111111111111'; // owns E1
const U2 = '22222222-2222-2222-2222-222222222222'; // owns E2 only
const E1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'; // active, owned by U1
const E2 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'; // draft (not accepting), owned by U2

let db: PGlite;

// Snapshot of the pre-migration "hole" so the fix is demonstrable before/after.
let anonCouldToggleBefore = false;

/** Reset to the bootstrap superuser, set the JWT-sub GUC, then optionally SET ROLE. */
async function setCaller(role: 'anon' | 'authenticated' | 'service_role' | null, uid?: string) {
  await db.exec('RESET ROLE;');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  if (role) await db.exec(`SET ROLE ${role};`);
}

async function fnPriv(role: string, sig: string): Promise<boolean> {
  await db.exec('RESET ROLE;');
  const r = await db.query<{ has: boolean }>(
    `select has_function_privilege($1, $2, 'EXECUTE') as has`,
    [role, sig],
  );
  return r.rows[0].has;
}

beforeAll(async () => {
  db = new PGlite();

  // ── Prerequisite: model of the production schema the migrations depend on ──
  await db.exec(`
    CREATE ROLE anon          NOLOGIN NOINHERIT;
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
    CREATE ROLE service_role  NOLOGIN NOINHERIT;

    -- Supabase exposes auth.uid() = the JWT 'sub' claim. Stub reads a GUC so
    -- each test can impersonate a caller. Returns NULL when unset (= anon).
    CREATE SCHEMA auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    CREATE TABLE public.users (
      id uuid PRIMARY KEY,
      is_super_admin boolean NOT NULL DEFAULT false
    );

    CREATE TABLE public.events (
      id uuid PRIMARY KEY,
      slug text UNIQUE,
      status text NOT NULL DEFAULT 'active',
      content_config jsonb,
      automation_config jsonb
    );

    CREATE TABLE public.user_events (
      user_id uuid NOT NULL,
      event_id uuid NOT NULL,
      role text
    );

    CREATE TABLE public.arrival_permits (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_id uuid NOT NULL,
      full_name text,
      phone text NOT NULL,
      attending boolean,
      guests_count smallint,
      needs_parking boolean,
      match_status text NOT NULL DEFAULT 'unmatched',
      invitation_id uuid,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT arrival_permits_event_phone_unique UNIQUE (event_id, phone)
    );

    CREATE TABLE public.invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL,
      group_name text,
      phone_numbers text[],
      rsvp_status text,
      confirmed_pax integer,
      invited_pax integer,
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE public.automation_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL,
      stage_name text NOT NULL,
      is_active boolean DEFAULT true
    );

    CREATE TABLE public.message_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid,
      invitation_id uuid,
      phone text,
      message_type text,
      content text,
      status text NOT NULL DEFAULT 'pending',
      error_log text,
      scheduled_for timestamptz,
      sent_at timestamptz
    );

    -- Supabase grants base table privileges to anon/authenticated; RLS is the
    -- row gate. Replicate so the RLS test exercises RLS, not a missing grant.
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.arrival_permits TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.events, public.invitations,
      public.automation_settings, public.message_logs TO authenticated;
    -- Supabase default privileges also grant authenticated SELECT on these.
    -- The arrival_permits owner/super-admin policies evaluate EXISTS subqueries
    -- against them as the querying role, so the grant must be present (same
    -- pattern invitations/message_logs already rely on in prod).
    GRANT SELECT ON public.users, public.user_events TO authenticated;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  `);

  // ── Stub functions the migrations REVOKE/REPLACE (must pre-exist, with the
  //    exact signatures). Created by the superuser, so EXECUTE defaults to
  //    PUBLIC — exactly the pre-migration hole anon exploited. ──
  await db.exec(`
    CREATE FUNCTION public.toggle_auto_pilot(p_event_id uuid, p_enabled boolean)
      RETURNS void LANGUAGE plpgsql AS $$ BEGIN END $$;
    CREATE FUNCTION public.update_whatsapp_template(p_event_id uuid, p_stage_name text, p_singular text, p_plural text)
      RETURNS void LANGUAGE plpgsql AS $$ BEGIN END $$;
    CREATE FUNCTION public.delete_dynamic_nudge(p_setting_id uuid)
      RETURNS void LANGUAGE plpgsql AS $$ BEGIN END $$;
    CREATE FUNCTION public.create_invitation_from_permit(p_permit_id bigint)
      RETURNS uuid LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
    CREATE FUNCTION public.link_permit_to_invitation(p_permit_id bigint, p_invitation_id uuid)
      RETURNS void LANGUAGE plpgsql AS $$ BEGIN END $$;
    CREATE FUNCTION public.create_onboarding_event(p1 text, p2 text, p3 jsonb, p4 text, p5 text, p6 date)
      RETURNS void LANGUAGE plpgsql AS $$ BEGIN END $$;
    CREATE FUNCTION public.handle_new_auth_user()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    CREATE FUNCTION public.sync_arrival_to_invitation()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    CREATE FUNCTION public.phone_core(p text)
      RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT p $$;
  `);

  // Snapshot the hole BEFORE applying the fix.
  anonCouldToggleBefore = await fnPriv('anon', 'public.toggle_auto_pilot(uuid, boolean)');

  // ── Seed data ──
  await db.exec(`
    INSERT INTO public.users (id, is_super_admin) VALUES
      ('${U1}', false), ('${U2}', false);
    INSERT INTO public.events (id, slug, status, content_config, automation_config) VALUES
      ('${E1}', 'event-one', 'active', '{}'::jsonb, '{}'::jsonb),
      ('${E2}', 'event-two', 'draft',  '{}'::jsonb, '{}'::jsonb);
    INSERT INTO public.user_events (user_id, event_id, role) VALUES
      ('${U1}', '${E1}', 'owner'),
      ('${U2}', '${E2}', 'owner');
    -- One existing permit per event (superuser insert, bypasses RLS).
    INSERT INTO public.arrival_permits (event_id, full_name, phone, attending, guests_count, needs_parking) VALUES
      ('${E1}', 'Seed One', '0500000000', true, 2, false),
      ('${E2}', 'Seed Two', '0500000099', true, 1, false);
    INSERT INTO public.automation_settings (event_id, stage_name) VALUES
      ('${E1}', 'nudge_1');
  `);

  // ── Apply the real migrations, in order ──
  await db.exec(mig(MIG_A));
  await db.exec(mig(MIG_B));
  await db.exec(mig(MIG_C));
});

afterAll(async () => {
  await db?.close();
});

// ───────────────────────────── B ─────────────────────────────
describe('B. arrival_permits RLS + submit_rsvp public path', () => {
  it('anon cannot SELECT any arrival_permits rows', async () => {
    await setCaller('anon');
    const r = await db.query('select * from public.arrival_permits');
    expect(r.rows.length).toBe(0);
  });

  it('anon cannot UPDATE arbitrary arrival_permits rows', async () => {
    await setCaller('anon');
    const r = await db.query(`update public.arrival_permits set full_name = 'hacked' returning id`);
    expect(r.rows.length).toBe(0); // RLS USING denies every row
  });

  it('anon cannot directly INSERT into arrival_permits', async () => {
    await setCaller('anon');
    await expect(
      db.query(
        `insert into public.arrival_permits (event_id, phone) values ($1, $2)`,
        [E1, '0512345678'],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('public RSVP via submit_rsvp works for an active event (positive path)', async () => {
    await setCaller('anon');
    await db.query('select public.submit_rsvp($1,$2,$3,$4,$5,$6)', [
      E1, 'Public Guest', '0511112222', true, 3, true,
    ]);
    await setCaller(null); // superuser verify
    const r = await db.query(
      'select full_name, guests_count from public.arrival_permits where event_id=$1 and phone=$2',
      [E1, '0511112222'],
    );
    expect(r.rows.length).toBe(1);
    expect((r.rows[0] as any).full_name).toBe('Public Guest');
  });

  it('submit_rsvp is rejected for a non-active event', async () => {
    await setCaller('anon');
    await expect(
      db.query('select public.submit_rsvp($1,$2,$3,$4,$5,$6)', [
        E2, 'Should Fail', '0599998888', true, 1, false,
      ]),
    ).rejects.toThrow(/not accepting/i);
  });

  it('submit_rsvp cannot reach a non-existent event (no enumeration)', async () => {
    await setCaller('anon');
    await expect(
      db.query('select public.submit_rsvp($1,$2,$3,$4,$5,$6)', [
        '00000000-0000-0000-0000-000000000000', 'x', '0500001111', true, 1, false,
      ]),
    ).rejects.toThrow(/not found/i);
  });

  it('authenticated owner sees ONLY their own event rows', async () => {
    await setCaller('authenticated', U1);
    const r = await db.query<{ event_id: string }>('select event_id from public.arrival_permits');
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((row) => row.event_id === E1)).toBe(true); // never sees E2
  });

  it('authenticated non-owner sees none of another event’s rows', async () => {
    await setCaller('authenticated', U1);
    const r = await db.query('select * from public.arrival_permits where event_id = $1', [E2]);
    expect(r.rows.length).toBe(0);
  });
});

// ───────────────────────────── C ─────────────────────────────
describe('C. RPC EXECUTE revocation + ownership guards', () => {
  const mutators = [
    'public.toggle_auto_pilot(uuid, boolean)',
    'public.update_whatsapp_template(uuid, text, text, text)',
    'public.delete_dynamic_nudge(uuid)',
    'public.create_invitation_from_permit(bigint)',
    'public.link_permit_to_invitation(bigint, uuid)',
    'public.create_onboarding_event(text, text, jsonb, text, text, date)',
  ];

  it('pre-migration: anon COULD execute toggle_auto_pilot (the hole existed)', () => {
    expect(anonCouldToggleBefore).toBe(true);
  });

  it('anon can no longer EXECUTE any mutation RPC', async () => {
    for (const sig of mutators) {
      expect(await fnPriv('anon', sig)).toBe(false);
    }
  });

  it('internal helpers are not executable by anon or authenticated', async () => {
    for (const sig of [
      'public.handle_new_auth_user()',
      'public.sync_arrival_to_invitation()',
      'public.phone_core(text)',
    ]) {
      expect(await fnPriv('anon', sig)).toBe(false);
      expect(await fnPriv('authenticated', sig)).toBe(false);
    }
  });

  it('authenticated retains EXECUTE on the legitimate mutators', async () => {
    for (const sig of mutators) {
      expect(await fnPriv('authenticated', sig)).toBe(true);
    }
  });

  it('a non-owner authenticated caller is blocked by the ownership guard', async () => {
    await setCaller('authenticated', U2); // U2 does not manage E1
    await expect(db.query('select public.toggle_auto_pilot($1, $2)', [E1, true])).rejects.toThrow(
      /not authorized/i,
    );
  });

  it('the owning authenticated caller succeeds (guard allows owner)', async () => {
    await setCaller('authenticated', U1);
    await db.query('select public.toggle_auto_pilot($1, $2)', [E1, true]);
    await setCaller(null);
    const r = await db.query<{ ap: boolean }>(
      `select (automation_config->>'auto_pilot')::boolean as ap from public.events where id=$1`,
      [E1],
    );
    expect(r.rows[0].ap).toBe(true);
  });

  it('a super-admin can manage any event', async () => {
    await setCaller(null);
    await db.query('update public.users set is_super_admin = true where id = $1', [U2]);
    await setCaller('authenticated', U2);
    await db.query('select public.toggle_auto_pilot($1, $2)', [E1, false]); // E1 not owned by U2
    await setCaller(null);
    await db.query('update public.users set is_super_admin = false where id = $1', [U2]); // reset
    const r = await db.query<{ ap: boolean }>(
      `select (automation_config->>'auto_pilot')::boolean as ap from public.events where id=$1`,
      [E1],
    );
    expect(r.rows[0].ap).toBe(false);
  });
});

// ───────────────────────────── D ─────────────────────────────
describe('D. WhatsApp atomic claim (no duplicate claim)', () => {
  it('claim is executable only by service_role', async () => {
    expect(await fnPriv('anon', 'public.claim_pending_messages(integer)')).toBe(false);
    expect(await fnPriv('authenticated', 'public.claim_pending_messages(integer)')).toBe(false);
    expect(await fnPriv('service_role', 'public.claim_pending_messages(integer)')).toBe(true);
  });

  it('two overlapping claim runs receive DISJOINT message sets', async () => {
    // Seed 6 due pending messages.
    await setCaller(null);
    await db.exec(`DELETE FROM public.message_logs;`);
    for (let i = 0; i < 6; i++) {
      await db.query(
        `insert into public.message_logs (event_id, phone, message_type, content, status, scheduled_for)
         values ($1, $2, 'icebreaker', 'hi', 'pending', now() - interval '1 minute')`,
        [E1, `05000000${10 + i}`],
      );
    }

    await setCaller('service_role');
    const runA = await db.query<{ id: string; status: string }>(
      'select id, status from public.claim_pending_messages(3)',
    );
    const runB = await db.query<{ id: string; status: string }>(
      'select id, status from public.claim_pending_messages(3)',
    );

    const idsA = new Set(runA.rows.map((r) => r.id));
    const idsB = new Set(runB.rows.map((r) => r.id));

    expect(runA.rows.length).toBe(3);
    expect(runB.rows.length).toBe(3);
    // Every claimed row is flipped to 'processing'.
    expect(runA.rows.every((r) => r.status === 'processing')).toBe(true);
    expect(runB.rows.every((r) => r.status === 'processing')).toBe(true);
    // No id appears in both runs → no message can be sent twice.
    const overlap = [...idsA].filter((id) => idsB.has(id));
    expect(overlap).toEqual([]);
  });

  it('a third run finds nothing left to claim (all already processing)', async () => {
    await setCaller('service_role');
    const runC = await db.query('select id from public.claim_pending_messages(10)');
    expect(runC.rows.length).toBe(0);
  });

  it('a row stuck in processing is NOT auto-reclaimed (at-most-once: never re-sends)', async () => {
    // Simulate a worker that crashed AFTER the Green API send but BEFORE writing
    // 'sent': the row is left in 'processing' with an old processing_started_at.
    // The fixed claim must NOT pick it up again — otherwise the guest is messaged
    // twice. (Stuck rows are handled by manual requeue, not auto-reclaim.)
    await setCaller(null);
    const one = await db.query<{ id: string }>('select id from public.message_logs limit 1');
    const stuckId = one.rows[0].id;
    await db.query(
      `update public.message_logs set processing_started_at = now() - interval '60 minutes' where id = $1`,
      [stuckId],
    );

    await setCaller('service_role');
    const reclaim = await db.query<{ id: string }>(
      'select id from public.claim_pending_messages(10)',
    );
    expect(reclaim.rows.map((r) => r.id)).not.toContain(stuckId);
  });
});

// ──────────────────── C (cross-tenant link guard) ────────────────────
describe('C2. link_permit_to_invitation cannot cross tenants', () => {
  it('an owner cannot link their permit to ANOTHER event’s invitation', async () => {
    // Fresh unmatched permit in E1, plus one invitation in each event.
    await setCaller(null);
    const p = await db.query<{ id: string }>(
      `insert into public.arrival_permits (event_id, full_name, phone, attending, guests_count, needs_parking)
       values ($1, 'Link Probe', '0577001100', true, 2, false) returning id`,
      [E1],
    );
    const permitId = p.rows[0].id;
    const invE1 = await db.query<{ id: string }>(
      `insert into public.invitations (event_id, group_name) values ($1, 'Inv E1') returning id`,
      [E1],
    );
    const invE2 = await db.query<{ id: string }>(
      `insert into public.invitations (event_id, group_name) values ($1, 'Inv E2') returning id`,
      [E2],
    );

    // U1 owns E1. Linking the E1 permit to an E2 invitation must be rejected.
    await setCaller('authenticated', U1);
    await expect(
      db.query('select public.link_permit_to_invitation($1, $2)', [permitId, invE2.rows[0].id]),
    ).rejects.toThrow(/does not belong/i);

    // Same-event link (E1 permit → E1 invitation) succeeds.
    await db.query('select public.link_permit_to_invitation($1, $2)', [permitId, invE1.rows[0].id]);
    await setCaller(null);
    const inv = await db.query<{ rsvp_status: string }>(
      `select rsvp_status from public.invitations where id = $1`,
      [invE1.rows[0].id],
    );
    expect(inv.rows[0].rsvp_status).toBe('attending');
  });
});
