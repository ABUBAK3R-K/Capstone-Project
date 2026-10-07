-- 010_places_dedupe_and_search.sql
--
-- 1. Lets seed_places.py upsert instead of blindly insert: every re-run used
--    to duplicate the whole OSM catalogue, which also skewed the recommender
--    (a place's own duplicate is its "most similar place").
-- 2. Bounds search_places for the new in-app search screen.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. OSM identity on places
-- ─────────────────────────────────────────────────────────────────────────

-- "node/123456" — the element type is part of OSM's identity, ids alone are
-- only unique per type. Null for user contributions and business listings.
alter table public.places add column if not exists osm_id text;

-- Not client-writable: 009 granted INSERT on an explicit column list, and a
-- column added later is not part of it.

-- Merge exact duplicates left by earlier seed runs (same name, category and
-- point), keeping the oldest row. Interactions are re-pointed to the keeper
-- first, so merging loses no recommendation history — a plain delete would
-- cascade it away (009).
create temporary table _place_duplicates on commit drop as
select id, keeper
from (
  select
    id,
    first_value(id) over (
      partition by name, category, location::text
      order by created_at, id
    ) as keeper
  from public.places
  where source = 'osm_seed' and osm_id is null
) ranked
where id <> keeper;

update public.interactions i
set place_id = d.keeper
from _place_duplicates d
where i.place_id = d.id;

delete from public.places p
using _place_duplicates d
where p.id = d.id;

-- Unique, but NULLs are distinct by default, so any number of non-OSM rows
-- can coexist. A plain (non-partial) index so `on conflict (osm_id)` can use it.
create unique index if not exists places_osm_id_key on public.places (osm_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. search_places: bounded, and matches category/type as well
-- ─────────────────────────────────────────────────────────────────────────

-- Same signature and return type as 004, so `create or replace` is enough.
-- Previously unbounded: a one-letter query returned the whole catalogue
-- over the wire. Results stay distance-ordered, so the 50 kept are the 50
-- nearest matches.
create or replace function search_places(
  search_query text,
  lat float,
  lng float
)
returns table (
  id uuid,
  name text,
  category text,
  subcategory text,
  description text,
  lat float,
  lng float,
  address text,
  images text[],
  source text,
  created_by uuid,
  created_at timestamptz
)
language sql
stable
as $$
  select
    p.id,
    p.name,
    p.category,
    p.subcategory,
    p.description,
    st_y(p.location::geometry) as lat,
    st_x(p.location::geometry) as lng,
    p.address,
    p.images,
    p.source,
    p.created_by,
    p.created_at
  from places p
  where
    p.name ilike '%' || search_query || '%'
    or p.description ilike '%' || search_query || '%'
    or p.category ilike '%' || search_query || '%'
    or p.subcategory ilike '%' || search_query || '%'
  order by
    st_distance(p.location, st_point(lng, lat)::geography) asc
  limit 50;
$$;
