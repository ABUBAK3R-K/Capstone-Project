-- 009_business_hardening.sql
--
-- Closes the write-path holes left by 008 (and two older ones in 002), all of
-- the same shape: RLS decides WHICH rows a client may write, but nothing
-- constrained WHICH COLUMNS or WHAT VALUES.
--
-- The headline exploit, with nothing but the anon key shipped in the app:
--
--     update businesses set verification_status = 'approved' where owner_id = auth.uid();
--     -- or just: insert into businesses (..., verification_status) values (..., 'approved');
--
-- 008 tried to lock that column with `revoke update (verification_status)`,
-- but a column-level REVOKE is a no-op while the role still holds the
-- table-level UPDATE that Supabase grants anon/authenticated by default
-- (Postgres docs, GRANT: "the table-level grant is unaffected by a
-- column-level operation"). The sync trigger then mirrored the self-approved
-- listing straight into public search/map. 007 got this right for profiles —
-- revoke the table grant, then grant back only the writable columns — and
-- this migration applies the same pattern everywhere 008 missed it.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. businesses: verification_status is admin-only, on insert AND update
-- ─────────────────────────────────────────────────────────────────────────

revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to anon, authenticated;

-- Omitted on purpose: id, verification_status (defaults to 'pending'),
-- verification_documents (attached after insert, see 008), created_at.
grant insert (
  owner_id, name, category, description, location, address,
  operating_hours, contact_phone, contact_email, offers
) on public.businesses to authenticated;

-- owner_id is omitted too, so a listing can't be handed to another account.
grant update (
  name, category, description, location, address,
  operating_hours, contact_phone, contact_email, offers, verification_documents
) on public.businesses to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. bookings: customers can't self-confirm, owners can only change status
-- ─────────────────────────────────────────────────────────────────────────

revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;

-- status and responded_at are omitted: every booking starts 'pending', and
-- only the business side moves it on.
grant insert (
  business_id, customer_id, service_id, service_type,
  requested_time, quantity, order_group_id, notes
) on public.bookings to authenticated;

-- RLS already limits UPDATE to the owning business; this limits it to the
-- one column accept/decline/complete actually needs. responded_at is stamped
-- by the transition trigger below rather than trusted from the client.
grant update (status) on public.bookings to authenticated;

-- A booking must reference a real, active service OF THAT business, and the
-- business must be approved. Without this a customer could pair any
-- business_id with any service_id, or book a listing still under review.
-- SECURITY DEFINER so the lookup sees the rows regardless of the caller's
-- RLS visibility (a pending business is invisible to customers, which would
-- otherwise surface as a misleading "service not found").
create or replace function public.validate_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  svc record;
begin
  select s.service_type, s.is_active, b.verification_status
    into svc
  from public.business_services s
  join public.businesses b on b.id = s.business_id
  where s.id = new.service_id
    and s.business_id = new.business_id;

  if not found then
    raise exception 'Service % does not belong to business %', new.service_id, new.business_id
      using errcode = 'check_violation';
  end if;

  if svc.verification_status <> 'approved' then
    raise exception 'This business is not accepting bookings yet'
      using errcode = 'check_violation';
  end if;

  if not svc.is_active then
    raise exception 'This service is no longer offered'
      using errcode = 'check_violation';
  end if;

  -- 008 documents service_type as snapshotted from the service at booking
  -- time — take it from the service, not from the client.
  new.service_type := svc.service_type;

  if new.service_type = 'appointment' then
    if new.requested_time is null then
      raise exception 'Appointments need a requested time'
        using errcode = 'check_violation';
    end if;
    if new.requested_time < now() then
      raise exception 'Requested time is in the past'
        using errcode = 'check_violation';
    end if;
  else
    new.requested_time := null;
  end if;

  -- Column grants already stop clients setting these; this also covers
  -- inserts made over DATABASE_URL, which bypass grants.
  new.status := 'pending';
  new.responded_at := null;

  return new;
end;
$$;

drop trigger if exists validate_new_booking on public.bookings;
create trigger validate_new_booking
  before insert on public.bookings
  for each row
  execute function public.validate_new_booking();

-- Status may only move forward along the lifecycle the business UI exposes:
-- pending → confirmed | declined, confirmed → completed. responded_at
-- mirrors problem_reports.resolved_at, stamped server-side.
create or replace function public.enforce_booking_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('confirmed', 'declined'))
      or (old.status = 'confirmed' and new.status = 'completed')
    ) then
      raise exception 'A booking cannot move from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    if old.status = 'pending' then
      new.responded_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_booking_transition on public.bookings;
create trigger enforce_booking_transition
  before update on public.bookings
  for each row
  execute function public.enforce_booking_transition();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. interactions → places: let a delisted business actually be delisted
-- ─────────────────────────────────────────────────────────────────────────

-- sync_business_place() (008) deletes the mirrored places row when a
-- business leaves 'approved'. With a plain FK, any business that had ever
-- been viewed (every place-detail open logs a 'view') could never be
-- rejected or removed — the delete raised a foreign-key violation and the
-- admin dashboard's "Remove from listings" failed.
--
-- Cascading drops that place's interaction history. That is the right call
-- for the recommender: interactions against a place that no longer exists
-- can't produce a recommendation anyway.
alter table public.interactions
  drop constraint if exists interactions_place_id_fkey,
  add constraint interactions_place_id_fkey
    foreign key (place_id) references public.places(id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. places: community contributions can't impersonate a business or a user
-- ─────────────────────────────────────────────────────────────────────────

-- 002's insert policy was `with check (true)`: any signed-in user could
-- insert a row with source = 'business' (indistinguishable from a verified
-- listing), credit it to someone else via created_by, or pre-claim the id
-- of a pending business so its approval would merge into their row.
drop policy if exists "Authenticated users can insert places" on public.places;
drop policy if exists "Authenticated users can contribute places as themselves" on public.places;
create policy "Authenticated users can contribute places as themselves"
on public.places for insert
to authenticated
with check (created_by = auth.uid() and source = 'user_added');

revoke all on public.places from anon, authenticated;
-- nearby_places/search_places are SECURITY INVOKER, so anon needs SELECT.
grant select on public.places to anon, authenticated;
-- id and created_at omitted: server-generated only.
grant insert (
  name, category, subcategory, description, location, address, images, source, created_by
) on public.places to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. problem_reports: a new report always starts as 'reported'
-- ─────────────────────────────────────────────────────────────────────────

-- 002's insert policy checked only user_id, so a citizen could file a report
-- that was already 'fixed', pre-assigned to an authority, or back-dated as
-- resolved — skewing the resolution-time analytics resolved_at exists for.
drop policy if exists "Users can insert own problem reports" on public.problem_reports;
create policy "Users can insert own problem reports"
on public.problem_reports for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'reported'
  and authority_id is null
  and resolved_at is null
);
