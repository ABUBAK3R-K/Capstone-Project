-- RLS + privilege test suite — covers migrations 002, 007, 008, 009 and 011.
--
-- Run the whole file in the Supabase SQL editor or via psql, as the postgres
-- role, AFTER applying every migration. It is self-checking: each check raises
-- "FAIL: <what broke>" and aborts on the first failure, so a run that reaches
-- the final SELECT means every check passed (psql also prints a NOTICE per
-- PASS). Everything — fixtures, helper functions, test writes — is rolled back
-- at the end; the database is left untouched.
--
-- Fixture legend
--   users       a…01 customer   a…02 admin   a…03 owner of B1   a…04 owner of B2   a…05 owner with no business yet
--   businesses  b…01 approved (mirrored into places)   b…02 pending
--   services    c…01 appointment @ B1   c…02 order @ B1   c…03 appointment @ B2
--   reports     d…01 filed by the customer

begin;

-- ════════════════════════════════════════════════════════════════════════
-- Helpers (rolled back with everything else)
-- ════════════════════════════════════════════════════════════════════════

-- Impersonate a signed-in user. auth.uid() reads request.jwt.claims on
-- current Supabase and request.jwt.claim.sub on older versions — set both.
create function public._rls_test_login(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
end;
$$;

create function public._rls_expect(ok boolean, label text) returns void
language plpgsql as $$
begin
  if not ok then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'PASS: %', label;
end;
$$;

grant execute on function public._rls_test_login(uuid) to authenticated;
grant execute on function public._rls_expect(boolean, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Fixtures (as postgres, bypassing RLS)
-- ════════════════════════════════════════════════════════════════════════

insert into auth.users (id) values
  ('a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000005')
on conflict do nothing;

-- handle_new_user() (006) has already created every profile above with role
-- 'user'. Promote the admin with an UPDATE — inserting the profile with
-- role 'admin' would be silently skipped by ON CONFLICT DO NOTHING, which is
-- what broke the admin case in the previous version of this script.
update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000002';

insert into public.businesses (id, owner_id, name, category, location, verification_status) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
   'RLS Test Salon', 'Salons', 'POINT(77.58 12.96)', 'approved'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004',
   'RLS Test Bakery', 'Bakeries', 'POINT(77.59 12.97)', 'pending');

insert into public.business_services (id, business_id, name, service_type, duration_minutes) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Haircut', 'appointment', 30),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Shampoo', 'order', null),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'Cake tasting', 'appointment', 15);

insert into public.problem_reports (id, user_id, category, location, description) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Garbage', 'POINT(77.58 12.96)', 'RLS test report');

do $$ begin
  perform public._rls_expect(
    exists (select 1 from public.places where id = 'b0000000-0000-0000-0000-000000000001'),
    'fixture: approved business is mirrored into places'
  );
end $$;

-- Everything below runs as a client would, through RLS and column grants.
set local role authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 1. problem_reports (002, 009)
-- ════════════════════════════════════════════════════════════════════════

do $$
declare n int;
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000001');

  perform public._rls_expect(
    (select count(*) from public.problem_reports where user_id <> 'a0000000-0000-0000-0000-000000000001') = 0,
    'reports: a citizen sees no one else''s reports'
  );
  perform public._rls_expect(
    exists (select 1 from public.problem_reports where id = 'd0000000-0000-0000-0000-000000000001'),
    'reports: a citizen sees their own report'
  );

  update public.problem_reports set status = 'fixed' where id = 'd0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 0, 'reports: a citizen cannot change status');

  begin
    insert into public.problem_reports (user_id, category, location, status)
    values ('a0000000-0000-0000-0000-000000000001', 'Pothole', 'POINT(77.58 12.96)', 'fixed');
    perform public._rls_expect(false, 'reports: a citizen cannot file a report as already fixed');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'reports: a citizen cannot file a report as already fixed');
  end;

  begin
    insert into public.problem_reports (user_id, category, location)
    values ('a0000000-0000-0000-0000-000000000003', 'Pothole', 'POINT(77.58 12.96)');
    perform public._rls_expect(false, 'reports: a citizen cannot file a report as someone else');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'reports: a citizen cannot file a report as someone else');
  end;

  insert into public.problem_reports (user_id, category, location, status)
  values ('a0000000-0000-0000-0000-000000000001', 'Pothole', 'POINT(77.58 12.96)', 'reported');
  perform public._rls_expect(true, 'reports: a citizen can file their own report');
end $$;

do $$
declare n int;
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000002');

  perform public._rls_expect(
    exists (select 1 from public.problem_reports where id = 'd0000000-0000-0000-0000-000000000001'),
    'reports: an admin sees other citizens'' reports'
  );

  update public.problem_reports set status = 'in_progress' where id = 'd0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 1, 'reports: an admin can change status');
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. profiles (007, 008)
-- ════════════════════════════════════════════════════════════════════════

do $$
declare n int;
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000001');

  begin
    update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
    perform public._rls_expect(false, 'profiles: a user cannot promote themselves to admin');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'profiles: a user cannot promote themselves to admin');
  end;

  begin
    update public.profiles set account_type = 'business' where id = 'a0000000-0000-0000-0000-000000000001';
    perform public._rls_expect(false, 'profiles: a user cannot change their account type');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'profiles: a user cannot change their account type');
  end;

  update public.profiles set name = 'Renamed' where id = 'a0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 1, 'profiles: a user can rename themselves');

  update public.profiles set name = 'Hijacked' where id = 'a0000000-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 0, 'profiles: a user cannot rename someone else');

  perform public._rls_expect(
    (select count(*) from public.profiles where id <> 'a0000000-0000-0000-0000-000000000001') = 0,
    'profiles: a user sees only their own profile'
  );
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. interactions (007)
-- ════════════════════════════════════════════════════════════════════════

do $$
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000001');

  begin
    insert into public.interactions (user_id, place_id, interaction_type)
    values ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'view');
    perform public._rls_expect(false, 'interactions: a user cannot log an interaction as someone else');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'interactions: a user cannot log an interaction as someone else');
  end;

  -- Also seeds the history that section 7 relies on.
  insert into public.interactions (user_id, place_id, interaction_type)
  values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'view');
  perform public._rls_expect(true, 'interactions: a user can log their own interaction');

  begin
    delete from public.interactions where user_id = 'a0000000-0000-0000-0000-000000000001';
    perform public._rls_expect(false, 'interactions: history is append-only (no delete)');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'interactions: history is append-only (no delete)');
  end;

  begin
    update public.interactions set interaction_type = 'visit' where user_id = 'a0000000-0000-0000-0000-000000000001';
    perform public._rls_expect(false, 'interactions: history is append-only (no update)');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'interactions: history is append-only (no update)');
  end;

  perform public._rls_expect(
    (select count(*) from public.interactions where user_id <> 'a0000000-0000-0000-0000-000000000001') = 0,
    'interactions: a user sees only their own history'
  );
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4. businesses (008, 009) — verification cannot be self-granted
-- ════════════════════════════════════════════════════════════════════════

do $$
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000005');

  begin
    insert into public.businesses (owner_id, name, category, location, verification_status)
    values ('a0000000-0000-0000-0000-000000000005', 'Sneaky Shop', 'Shops', 'POINT(77.6 12.9)', 'approved');
    perform public._rls_expect(false, 'businesses: an owner cannot insert a pre-approved listing');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'businesses: an owner cannot insert a pre-approved listing');
  end;

  begin
    insert into public.businesses (owner_id, name, category, location)
    values ('a0000000-0000-0000-0000-000000000003', 'Not Mine', 'Shops', 'POINT(77.6 12.9)');
    perform public._rls_expect(false, 'businesses: a user cannot create a listing owned by someone else');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'businesses: a user cannot create a listing owned by someone else');
  end;

  insert into public.businesses (owner_id, name, category, location)
  values ('a0000000-0000-0000-0000-000000000005', 'Honest Shop', 'Shops', 'POINT(77.6 12.9)');

  perform public._rls_expect(
    (select verification_status from public.businesses where owner_id = 'a0000000-0000-0000-0000-000000000005') = 'pending',
    'businesses: a new listing starts pending'
  );
  perform public._rls_expect(
    not exists (
      select 1 from public.places p
      join public.businesses b on b.id = p.id
      where b.owner_id = 'a0000000-0000-0000-0000-000000000005'
    ),
    'businesses: a pending listing is not published to places'
  );
end $$;

do $$
declare n int;
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000004');

  begin
    update public.businesses set verification_status = 'approved' where id = 'b0000000-0000-0000-0000-000000000002';
    perform public._rls_expect(false, 'businesses: an owner cannot approve their own listing');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'businesses: an owner cannot approve their own listing');
  end;

  begin
    update public.businesses set owner_id = 'a0000000-0000-0000-0000-000000000001' where id = 'b0000000-0000-0000-0000-000000000002';
    perform public._rls_expect(false, 'businesses: an owner cannot hand their listing to another account');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'businesses: an owner cannot hand their listing to another account');
  end;

  update public.businesses set name = 'RLS Test Bakery (renamed)' where id = 'b0000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 1, 'businesses: an owner can edit their own listing details');

  update public.businesses set name = 'Defaced' where id = 'b0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 0, 'businesses: an owner cannot edit someone else''s listing');
end $$;

do $$
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000001');

  perform public._rls_expect(
    not exists (select 1 from public.businesses where id = 'b0000000-0000-0000-0000-000000000002'),
    'businesses: customers cannot see a pending listing'
  );
  perform public._rls_expect(
    exists (select 1 from public.businesses where id = 'b0000000-0000-0000-0000-000000000001'),
    'businesses: customers can see an approved listing'
  );
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. bookings (008, 009)
-- ════════════════════════════════════════════════════════════════════════

do $$
declare n int;
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000001');

  begin
    insert into public.bookings (business_id, customer_id, service_id, service_type, requested_time, status)
    values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001', 'appointment', now() + interval '1 day', 'confirmed');
    perform public._rls_expect(false, 'bookings: a customer cannot create a pre-confirmed booking');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'bookings: a customer cannot create a pre-confirmed booking');
  end;

  begin
    insert into public.bookings (business_id, customer_id, service_id, service_type, requested_time)
    values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000003', 'appointment', now() + interval '1 day');
    perform public._rls_expect(false, 'bookings: a service from another business is rejected');
  exception when check_violation then
    perform public._rls_expect(true, 'bookings: a service from another business is rejected');
  end;

  begin
    insert into public.bookings (business_id, customer_id, service_id, service_type, requested_time)
    values ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000003', 'appointment', now() + interval '1 day');
    perform public._rls_expect(false, 'bookings: a pending business cannot be booked');
  exception when check_violation then
    perform public._rls_expect(true, 'bookings: a pending business cannot be booked');
  end;

  begin
    insert into public.bookings (business_id, customer_id, service_id, service_type, requested_time)
    values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001', 'appointment', now() - interval '1 day');
    perform public._rls_expect(false, 'bookings: an appointment in the past is rejected');
  exception when check_violation then
    perform public._rls_expect(true, 'bookings: an appointment in the past is rejected');
  end;

  begin
    insert into public.bookings (business_id, customer_id, service_id, service_type, requested_time)
    values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
            'c0000000-0000-0000-0000-000000000001', 'appointment', now() + interval '1 day');
    perform public._rls_expect(false, 'bookings: a customer cannot book on someone else''s behalf');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'bookings: a customer cannot book on someone else''s behalf');
  end;

  -- Client claims 'order' for an appointment service: the trigger must
  -- snapshot the real type from the service.
  insert into public.bookings (business_id, customer_id, service_id, service_type, requested_time, notes)
  values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
          'c0000000-0000-0000-0000-000000000001', 'order', now() + interval '1 day', 'rls-test');

  perform public._rls_expect(
    (select status = 'pending' and service_type = 'appointment' and requested_time is not null
       from public.bookings where notes = 'rls-test'),
    'bookings: a valid booking starts pending with the service''s real type'
  );

  begin
    update public.bookings set status = 'confirmed' where notes = 'rls-test';
    perform public._rls_expect(false, 'bookings: a customer cannot confirm their own booking');
  exception when check_violation then
    perform public._rls_expect(true, 'bookings: a customer cannot confirm their own booking');
  end;

  -- A second booking, used by the cancellation checks (5b).
  insert into public.bookings (business_id, customer_id, service_id, service_type, quantity, notes)
  values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
          'c0000000-0000-0000-0000-000000000002', 'order', 2, 'rls-cancel');
end $$;

do $$
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000004');

  perform public._rls_expect(
    not exists (select 1 from public.bookings where notes = 'rls-test'),
    'bookings: another business cannot see the booking'
  );
end $$;

do $$
declare n int;
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000003');

  begin
    update public.bookings set customer_id = 'a0000000-0000-0000-0000-000000000005' where notes = 'rls-test';
    perform public._rls_expect(false, 'bookings: an owner cannot rewrite who booked');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'bookings: an owner cannot rewrite who booked');
  end;

  begin
    update public.bookings set status = 'completed' where notes = 'rls-test';
    perform public._rls_expect(false, 'bookings: pending cannot jump straight to completed');
  exception when check_violation then
    perform public._rls_expect(true, 'bookings: pending cannot jump straight to completed');
  end;

  update public.bookings set status = 'confirmed' where notes = 'rls-test';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 1, 'bookings: the owner can confirm a pending booking');
  perform public._rls_expect(
    (select responded_at is not null from public.bookings where notes = 'rls-test'),
    'bookings: confirming stamps responded_at server-side'
  );

  begin
    update public.bookings set status = 'declined' where notes = 'rls-test';
    perform public._rls_expect(false, 'bookings: a confirmed booking cannot be declined');
  exception when check_violation then
    perform public._rls_expect(true, 'bookings: a confirmed booking cannot be declined');
  end;

  update public.bookings set status = 'completed' where notes = 'rls-test';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 1, 'bookings: the owner can complete a confirmed booking');
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5b. Customer cancellation (011)
-- ════════════════════════════════════════════════════════════════════════

do $$
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000003');

  begin
    update public.bookings set status = 'cancelled' where notes = 'rls-cancel';
    perform public._rls_expect(false, 'cancellation: the business cannot cancel on the customer''s behalf');
  exception when check_violation then
    perform public._rls_expect(true, 'cancellation: the business cannot cancel on the customer''s behalf');
  end;
end $$;

do $$
declare n int;
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000001');

  update public.bookings set status = 'cancelled' where notes = 'rls-cancel';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 1, 'cancellation: a customer can cancel their own pending booking');
  perform public._rls_expect(
    (select responded_at is null from public.bookings where notes = 'rls-cancel'),
    'cancellation: cancelling does not count as a business response'
  );

  begin
    update public.bookings set status = 'pending' where notes = 'rls-cancel';
    perform public._rls_expect(false, 'cancellation: a cancelled booking cannot be reopened');
  exception when check_violation then
    perform public._rls_expect(true, 'cancellation: a cancelled booking cannot be reopened');
  end;

  begin
    update public.bookings set status = 'cancelled' where notes = 'rls-test';
    perform public._rls_expect(false, 'cancellation: a completed booking cannot be cancelled');
  exception when check_violation then
    perform public._rls_expect(true, 'cancellation: a completed booking cannot be cancelled');
  end;
end $$;

do $$
declare n int;
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000005');

  update public.bookings set status = 'cancelled' where notes = 'rls-cancel';
  get diagnostics n = row_count;
  perform public._rls_expect(n = 0, 'cancellation: nobody else can touch the booking');
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. places (002, 009) — community contributions
-- ════════════════════════════════════════════════════════════════════════

do $$
begin
  perform public._rls_test_login('a0000000-0000-0000-0000-000000000001');

  begin
    insert into public.places (name, category, location, created_by)
    values ('Fake credit', 'Parks', 'POINT(77.6 12.9)', 'a0000000-0000-0000-0000-000000000003');
    perform public._rls_expect(false, 'places: a contribution cannot be credited to someone else');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'places: a contribution cannot be credited to someone else');
  end;

  begin
    insert into public.places (name, category, location, created_by, source)
    values ('Fake business', 'Shops', 'POINT(77.6 12.9)', 'a0000000-0000-0000-0000-000000000001', 'business');
    perform public._rls_expect(false, 'places: a contribution cannot pose as a verified business');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'places: a contribution cannot pose as a verified business');
  end;

  begin
    insert into public.places (id, name, category, location, created_by)
    values ('b0000000-0000-0000-0000-000000000002', 'Id squat', 'Shops', 'POINT(77.6 12.9)',
            'a0000000-0000-0000-0000-000000000001');
    perform public._rls_expect(false, 'places: a contribution cannot choose its own id');
  exception when insufficient_privilege then
    perform public._rls_expect(true, 'places: a contribution cannot choose its own id');
  end;

  insert into public.places (name, category, location, created_by)
  values ('Real community place', 'Parks', 'POINT(77.6 12.9)', 'a0000000-0000-0000-0000-000000000001');
  perform public._rls_expect(true, 'places: a user can contribute a place as themselves');
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. Delisting a business that has interaction history (009)
-- ════════════════════════════════════════════════════════════════════════

reset role;

do $$
begin
  -- B1 has a 'view' from section 3. Before 009 this raised a foreign-key
  -- violation and the admin dashboard could never remove the listing.
  update public.businesses set verification_status = 'rejected' where id = 'b0000000-0000-0000-0000-000000000001';

  perform public._rls_expect(
    not exists (select 1 from public.places where id = 'b0000000-0000-0000-0000-000000000001'),
    'delisting: a rejected business is removed from places despite interaction history'
  );
  perform public._rls_expect(
    not exists (select 1 from public.interactions where place_id = 'b0000000-0000-0000-0000-000000000001'),
    'delisting: its interactions are cascaded away'
  );
end $$;

select 'ALL RLS CHECKS PASSED' as result;

rollback;
