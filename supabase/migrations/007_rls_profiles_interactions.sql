-- 007_rls_profiles_interactions.sql
--
-- Migration 002 enabled RLS on places and problem_reports but never covered
-- profiles or interactions. Both were left with Supabase's default grants to
-- anon and authenticated (INSERT/SELECT/UPDATE/DELETE/TRUNCATE), and the anon
-- key ships inside the mobile bundle by design.
--
-- The concrete exploit that closes here:
--
--     update profiles set role = 'admin';
--
-- The problem_reports SELECT policy trusts profiles.role, so self-promoting to
-- admin unlocked reading every citizen's report — photo, GPS coordinate and
-- description. Interactions could equally be read, forged or truncated.
--
-- Note on why RLS alone is not enough for profiles: a row-level policy can
-- restrict WHICH rows a user writes, but not WHICH COLUMNS. A self-update
-- policy would still let a user change their own role. Column-level privileges
-- are the mechanism that actually pins `role` shut, so this migration uses both.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Read your own profile. Note this keeps the authority check in migration 002
-- working: that policy's subquery is `where id = auth.uid()`, which is exactly
-- the row this policy exposes.
drop policy if exists "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- Update your own profile. Combined with the column grants below, this means
-- "you may rename yourself", not "you may promote yourself".
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Column-level privileges: `role` is not self-writable by anybody.
-- Role changes are an administrative act, performed by the service role or a
-- DBA, never by the account being promoted.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;

-- No INSERT grant is issued on purpose. Rows are created exclusively by
-- public.handle_new_user() (migration 006), which is SECURITY DEFINER and owned
-- by a role that bypasses RLS, so signup provisioning is unaffected by this.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. interactions
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.interactions enable row level security;

-- You may log an interaction only as yourself. This closes the forged-training-
-- corpus path: previously anyone holding the anon key could invent interaction
-- history for arbitrary user_ids and skew the collaborative model.
drop policy if exists "Users can log their own interactions" on public.interactions;
create policy "Users can log their own interactions"
on public.interactions for insert
to authenticated
with check (user_id = auth.uid());

-- Your own interaction history is yours. Implicit feedback is behavioural data:
-- which places a person visited is exactly as sensitive as where they have been.
drop policy if exists "Users can read their own interactions" on public.interactions;
create policy "Users can read their own interactions"
on public.interactions for select
to authenticated
using (user_id = auth.uid());

-- Interactions are an append-only log. Nobody rewrites or deletes history, and
-- TRUNCATE in particular should never have been reachable from a client key.
revoke all on public.interactions from anon, authenticated;
grant select, insert on public.interactions to authenticated;

-- The recommendation microservice is unaffected: it connects over DATABASE_URL
-- as the postgres role, which bypasses RLS, so it still reads the full
-- interaction corpus to build the collaborative matrix.
