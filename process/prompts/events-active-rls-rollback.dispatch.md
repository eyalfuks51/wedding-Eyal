# Codex Dispatch — Author paired rollback for migration 20260429085225

**Executor:** codex (headless, non-interactive)
**Branch:** `chore/events-active-rls-rollback` (already checked out — stay on it; do NOT switch or push)
**Scope:** CODE-ONLY. Create one SQL file. NO database connection, NO apply, NO rollback execution, NO `supabase`/`psql`/network commands.

## Background
Migration `supabase/migrations/20260429085225_events_authenticated_active_rls.sql` is already applied to the live DB but has no paired rollback file. Every other migration in `supabase/rollback/` has one; this one is missing. Author it. The file is a DORMANT artifact — it is NOT executed in this task.

The migration's entire body is:
```sql
CREATE POLICY "Authenticated can select active events"
  ON events FOR SELECT TO authenticated
  USING (status = 'active');
```

## Task — create exactly ONE file
Path: `supabase/rollback/20260429085225_events_authenticated_active_rls.down.sql`

Content must invert the migration and nothing else: drop that one policy, guarded with `IF EXISTS`. Match the house style of existing files in `supabase/rollback/` — read `supabase/rollback/20260614120000_arrival_permits_rls_hardening.down.sql` for the header format (a `═══` comment block stating `ROLLBACK for <migration>.sql` + a one-line rationale, then the DDL). Use the `public.` schema prefix as those files do.

The operative line:
```sql
DROP POLICY IF EXISTS "Authenticated can select active events" ON public.events;
```

## Hard constraints
- Touch ONLY the one new file above. Do NOT edit the migration, CLAUDE.md, AGENTS.md, or any source/config.
- Do NOT commit, stage, push, or switch branches. The orchestrator commits.
- Do NOT connect to or mutate any database. No `supabase db`, no `psql`, no network calls.

## Fail-closed termination contract
> NOTE: a tracked `REPORT.md` already exists at repo root (a different slice's report). Do NOT touch it. Use the slice-specific names below.
- SUCCESS → write `CODEX-ROLLBACK-REPORT.md` at repo root containing: the filename created, the exact SQL written (fenced), explicit confirmation that no DB was touched, and the `git status --short` output proving only the new rollback file (+ this report) changed.
- BLOCKED → write `CODEX-ROLLBACK-BLOCKED.md` at repo root with the reason and the current tree state. Never leave a half-finished tree, never guess.
