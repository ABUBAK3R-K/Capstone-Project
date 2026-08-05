-- Enable PostGIS extension for geographical mapping and pgcrypto for UUID generation
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- 1. Profiles Table (Linked to Supabase Auth users)
create table profiles (
  id uuid primary key references auth.users(id),
  name text,
  role text default 'user' check (role in ('user', 'authority', 'admin')),
  created_at timestamptz default now()
);

-- 2. Places Table (Local businesses, shops, public/religious locations)
create table places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  subcategory text,
  description text,
  location geography(Point, 4326) not null,
  address text,
  images text[],
  source text default 'user_added',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Spatial index for high-performance proximity queries on places
create index places_location_idx on places using gist (location);

-- 3. User-Place Interactions Table (Used for recommendations)
create table interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  place_id uuid references places(id),
  interaction_type text check (interaction_type in ('view', 'visit', 'favorite')),
  created_at timestamptz default now()
);

-- 4. Problem Reports Table (Civic issues reported by users)
create table problem_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  photo_url text,
  category text,
  location geography(Point, 4326) not null,
  description text,
  status text default 'reported' check (status in ('reported', 'in_progress', 'fixed')),
  authority_id uuid references profiles(id),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Spatial index for proximity queries on problem reports
create index reports_location_idx on problem_reports using gist (location);
