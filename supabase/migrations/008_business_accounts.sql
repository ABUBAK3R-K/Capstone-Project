-- 008_business_accounts.sql
--
-- Adds business accounts as a second product surface alongside the existing
-- customer flow. Two integration choices worth calling out:
--   1. profiles.role (civic permission level) is left untouched; account_type
--      is a new, separately-locked column — see 007's rationale for why role
--      itself must never become client-writable.
--   2. Approved businesses are mirrored into `places` sharing the SAME id
--      (profiles.id = auth.users.id is the existing precedent for this),
--      so nearby_places/search_places and the recommender need no changes.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. profiles.account_type
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists account_type text
  default 'customer'
  check (account_type in ('customer', 'business'));

-- Extend signup provisioning to read account_type from signUp(options.data),
-- same mechanism migration 006 already uses for `name`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, account_type)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    'user',
    coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'customer')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- account_type is set once at signup and never client-writable afterwards —
-- prevents a rejected business from flipping to 'customer' and back to
-- reset verification_status, and keeps the same locked-column shape as role.
revoke update (account_type) on public.profiles from authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. businesses
-- ─────────────────────────────────────────────────────────────────────────

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  category text not null,
  description text,
  location geography(Point, 4326) not null,
  address text,
  operating_hours jsonb not null default '{}'::jsonb,
  -- Shape: { "mon": {"open": "09:00", "close": "17:00"}, ..., "sun": null }
  -- jsonb over a normalized business_hours table: nothing in this product
  -- queries "who's open right now" yet, and this keeps the migration small.
  -- Revisit as a normalized table if that query need shows up.
  contact_phone text,
  contact_email text,
  offers text[],
  -- text[] mirrors places.images — a short list of promo strings, no
  -- separate offers table needed for the MVP.
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  verification_documents text[],
  -- Storage *paths* in the private bucket below, not public URLs.
  created_at timestamptz default now()
);

create index businesses_location_idx on public.businesses using gist (location);
create index businesses_owner_idx on public.businesses (owner_id);
create unique index businesses_owner_unique on public.businesses (owner_id);
-- One business per owner account for the MVP; drop this if that's wrong.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. business_services
-- ─────────────────────────────────────────────────────────────────────────

create table public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2),
  service_type text not null check (service_type in ('appointment', 'order')),
  duration_minutes int,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create index business_services_business_idx on public.business_services (business_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. bookings (covers both appointments and orders)
-- ─────────────────────────────────────────────────────────────────────────

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  customer_id uuid not null references public.profiles(id),
  service_id uuid not null references public.business_services(id),
  service_type text not null check (service_type in ('appointment', 'order')),
  -- Snapshotted from business_services at booking time so a later edit to
  -- the service definition doesn't rewrite the meaning of past bookings.
  requested_time timestamptz,
  -- Appointments only; null for orders.
  quantity int not null default 1 check (quantity > 0),
  order_group_id uuid,
  -- Groups multiple order-type rows submitted together as one basket.
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'completed')),
  created_at timestamptz default now(),
  responded_at timestamptz
  -- Stamped when the business accepts/declines — mirrors resolved_at on
  -- problem_reports.
);

create index bookings_business_status_idx on public.bookings (business_id, status);
create index bookings_customer_idx on public.bookings (customer_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Mirror approved businesses into places (shared id, no new FK)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.sync_business_place()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'approved' then
    insert into public.places (id, name, category, description, location, address, source, created_by)
    values (new.id, new.name, new.category, new.description, new.location, new.address, 'business', new.owner_id)
    on conflict (id) do update set
      name = excluded.name,
      category = excluded.category,
      description = excluded.description,
      location = excluded.location,
      address = excluded.address;
  else
    delete from public.places where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_business_verification_change on public.businesses;
create trigger on_business_verification_change
  after insert or update on public.businesses
  for each row
  execute function public.sync_business_place();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────────────────

alter table public.businesses enable row level security;
alter table public.business_services enable row level security;
alter table public.bookings enable row level security;

-- businesses: public sees only approved rows; owner sees their own regardless.
create policy "Approved businesses are publicly readable"
on public.businesses for select
to public
using (verification_status = 'approved' or owner_id = auth.uid());

create policy "Owners can insert their own business"
on public.businesses for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Owners can update their own business"
on public.businesses for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- verification_status is an admin-review act, not a self-service edit — same
-- column-lock pattern as profiles.role. The admin dashboard already connects
-- via DATABASE_URL as the postgres role (see 007's note on the
-- recommendation service), which bypasses RLS entirely, so approve/reject
-- needs no separate RLS carve-out.
--
-- verification_documents is NOT locked: the owner must be able to attach
-- uploaded document paths to their own (already-existing) business row after
-- creating it — the storage path below requires the business id up front, so
-- documents can never be set at INSERT time. This column carries no
-- privilege-escalation risk (it doesn't affect what the business can see or
-- do), unlike verification_status.
revoke update (verification_status) on public.businesses from authenticated;

-- business_services: public reads services of approved businesses; owner
-- manages their own regardless of approval state (setup during 'pending').
create policy "Services of approved businesses are publicly readable"
on public.business_services for select
to public
using (
  exists (select 1 from public.businesses b where b.id = business_id and b.verification_status = 'approved')
  or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
);

create policy "Owners manage their own services"
on public.business_services for all
to authenticated
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- bookings: customer sees/creates their own; business owner sees/updates
-- bookings against their own business (accept/decline).
create policy "Customers can create their own bookings"
on public.bookings for insert
to authenticated
with check (customer_id = auth.uid());

create policy "Customers can read their own bookings"
on public.bookings for select
to authenticated
using (customer_id = auth.uid());

create policy "Business owners can read bookings for their business"
on public.bookings for select
to authenticated
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "Business owners can update bookings for their business"
on public.bookings for update
to authenticated
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Private storage bucket for verification documents
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('business-verification', 'business-verification', false)
on conflict (id) do nothing;

-- No public SELECT policy at all — default-deny. Path convention:
-- business-verification/{business_id}/{filename}

create policy "Owners can upload their own verification documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'business-verification'
  and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1]
    and b.owner_id = auth.uid()
  )
);

create policy "Owners and reviewers can view verification documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'business-verification'
  and (
    exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1]
      and b.owner_id = auth.uid()
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('authority', 'admin'))
  )
);
