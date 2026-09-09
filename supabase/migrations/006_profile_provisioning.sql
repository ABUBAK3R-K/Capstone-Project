-- 006_profile_provisioning.sql
--
-- Every signup creates a row in auth.users, but nothing ever created the
-- matching row in public.profiles. Five foreign keys reference profiles
-- (interactions.user_id, places.created_by, problem_reports.user_id,
-- problem_reports.authority_id), so without this the app could not insert a
-- report or an interaction for a real user, and the admin dashboard's
-- role lookup returned no rows for every account.
--
-- This migration provisions profiles automatically and backfills the users
-- that signed up before it existed.

-- 1. Trigger function: create the profile row for a newly registered user.
--
-- SECURITY DEFINER is required because the insert into auth.users runs as the
-- Supabase auth admin role, which has no rights on public.profiles.
-- search_path is pinned so the function cannot be hijacked by a caller-supplied
-- schema on the path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    -- Supabase puts anything passed to signUp(options.data) here. Fall back to
    -- the local part of the email so the dashboard never shows a blank name.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    'user'
  )
  -- Never let a duplicate abort the signup transaction: a failure here surfaces
  -- to the client as "Database error saving new user" and blocks registration.
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 2. Fire it after every new auth user.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 3. Backfill: give every pre-existing auth user a profile.
insert into public.profiles (id, name, role)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(u.email, '@', 1)
  ),
  'user'
from auth.users u
on conflict (id) do nothing;

-- 4. Promote an authority account for the dashboard.
--
-- The Streamlit dashboard gates on profiles.role in ('authority','admin'), so
-- until at least one account holds that role it can only run with SKIP_AUTH=true.
-- Change the email here to whoever should own report triage on a fresh project.
update public.profiles
set role = 'authority'
where id = (select id from auth.users where email = 'abubakerkadli82@gmail.com');
