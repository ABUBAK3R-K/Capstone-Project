-- 1. Enable RLS on tables
alter table places enable row level security;
alter table problem_reports enable row level security;

-- 2. Places RLS Policies
-- Readable by everyone (including anon)
create policy "Places are publicly readable"
on places for select
to public
using (true);

-- Insertable by authenticated users
create policy "Authenticated users can insert places"
on places for insert
to authenticated
with check (true);

-- 3. Problem Reports RLS Policies
-- Insertable by authenticated users (must match their own user_id)
create policy "Users can insert own problem reports"
on problem_reports for insert
to authenticated
with check (user_id = auth.uid());

-- Readable by owner OR authority/admin
create policy "Users can read own reports or authorities can read all"
on problem_reports for select
to authenticated
using (
  user_id = auth.uid() 
  or exists (
    select 1 from profiles 
    where id = auth.uid() and role in ('authority', 'admin')
  )
);

-- Updatable ONLY by authority/admin (for status updates)
create policy "Authorities and admins can update reports"
on problem_reports for update
to authenticated
using (
  exists (
    select 1 from profiles 
    where id = auth.uid() and role in ('authority', 'admin')
  )
);

-- 4. PostGIS Geospatial Search Function (nearby_places)
-- This function can be called via Supabase RPC from the Flutter app
create or replace function nearby_places(
  lat float,
  lng float,
  radius_meters int,
  filter_category text default null
)
returns setof places
language sql
as $$
  select *
  from places
  where
    st_dwithin(
      location,
      st_point(lng, lat)::geography,
      radius_meters
    )
    and (filter_category is null or category = filter_category)
  order by
    st_distance(location, st_point(lng, lat)::geography) asc;
$$;
