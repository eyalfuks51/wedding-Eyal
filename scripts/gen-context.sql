-- gen-context.sql — Supabase schema introspection that feeds docs/SCHEMA.md
--
-- WHY no `npm run`: the anon + service-role keys in .env.local are PostgREST
-- JWTs, not Postgres passwords, and PostgREST does not expose information_schema.
-- There is no DATABASE_URL / DB password in the repo, so a `pg` script cannot
-- connect. Regeneration is therefore AGENT-RUN: an agent runs the three queries
-- below through the read-only `supabase-db` MCP and pastes the results into
-- docs/SCHEMA.md (above the "Hand-maintained notes" divider). Update the
-- "Generated <date>" line in that file when you do.
--
-- Trigger a regen after ANY migration that adds/renames a table, column, RLS
-- policy, or RPC. This replaces hand-editing the schema by memory.

-- 1. Tables + columns (ordinal order)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 2. RLS policies (per table, per command, with predicates)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3. Functions / RPC: identity signature, SECURITY mode, and ACL grants
--    (ACL "(default: PUBLIC)" = a grant hole — every P0 RPC must show an
--     explicit role list, never the default.)
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       case p.prosecdef when true then 'DEFINER' else 'INVOKER' end as security,
       coalesce(array_to_string(p.proacl::text[], ' | '), '(default: PUBLIC)') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;
