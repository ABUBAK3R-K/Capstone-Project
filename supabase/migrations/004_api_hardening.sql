-- 1. Drop the previous nearby_places function that returned raw geography
drop function if exists nearby_places(float, float, int, text);

-- 2. Redefine nearby_places to cleanly unpack location into lat and lng
create or replace function nearby_places(
  lat float,
  lng float,
  radius_meters int,
  filter_category text default null
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
as $$
  select 
    id,
    name,
    category,
    subcategory,
    description,
    st_y(location::geometry) as lat,
    st_x(location::geometry) as lng,
    address,
    images,
    source,
    created_by,
    created_at
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

-- 3. Create search_places function for text-based queries
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
as $$
  select 
    id,
    name,
    category,
    subcategory,
    description,
    st_y(location::geometry) as lat,
    st_x(location::geometry) as lng,
    address,
    images,
    source,
    created_by,
    created_at
  from places
  where
    name ilike '%' || search_query || '%'
    or description ilike '%' || search_query || '%'
  order by
    st_distance(location, st_point(lng, lat)::geography) asc;
$$;
