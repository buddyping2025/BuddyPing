-- ============================================================
-- BuddyPing — Initial Database Schema
-- ============================================================
-- Prerequisites (enable in Supabase Dashboard → Database → Extensions):
--   - postgis
--   - pg_cron
--   - pg_net

create extension if not exists postgis;

-- ============================================================
-- USERS TABLE
-- Linked to Supabase auth.users via FK on id.
-- id = auth.uid() — no separate clerk_id needed.
-- ============================================================
create table public.users (
  id                          uuid primary key references auth.users(id) on delete cascade,
  email                       text unique not null,
  username                    text unique not null,
  display_name                text,
  bio                         text,
  avatar_url                  text,

  -- Single user-level threshold (applies to all friendships)
  -- Each user's own threshold determines whether THEY get notified
  distance_threshold_meters   integer not null default 5000,

  -- Only the LATEST GPS location is stored — no history
  -- PostGIS Geography POINT: stored as POINT(longitude latitude)
  last_location               geography(Point, 4326),
  last_location_updated_at    timestamptz,

  -- OneSignal push subscription ID — populated after notification permission
  onesignal_player_id         text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Spatial index for fast proximity queries using ST_DWithin / ST_Distance
create index idx_users_last_location
  on public.users using gist (last_location);

-- ============================================================
-- FRIENDSHIPS TABLE
-- ============================================================
create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Prevent duplicate requests (same pair in same order)
  unique (requester_id, addressee_id),
  -- Prevent self-friending
  check (requester_id != addressee_id)
);

create index idx_friendships_requester on public.friendships (requester_id);
create index idx_friendships_addressee on public.friendships (addressee_id);
create index idx_friendships_status    on public.friendships (status);

-- ============================================================
-- NOTIFICATION LOGS TABLE
-- Used for deduplication: max 2 notifications per user/friend pair per day
-- Written only by the Edge Function (service_role key)
-- ============================================================
create table public.notification_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  friend_id        uuid not null references public.users(id) on delete cascade,
  notified_at      timestamptz not null default now(),
  distance_meters  float not null
);

-- Index for fast "how many notifications today for this pair" queries
create index idx_notification_logs_pair_date
  on public.notification_logs (user_id, friend_id, notified_at);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at_column();

create trigger friendships_updated_at
  before update on public.friendships
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- USERS
alter table public.users enable row level security;

-- Anyone can search users (for friend search feature)
create policy "users_select_all"
  on public.users for select using (true);

-- Users can only insert their own row (id must match auth.uid())
create policy "users_insert_own"
  on public.users for insert with check (id = auth.uid());

-- Users can only update their own row
create policy "users_update_own"
  on public.users for update using (id = auth.uid());

-- FRIENDSHIPS
alter table public.friendships enable row level security;

-- Users can see friendships they are part of
create policy "friendships_select_own"
  on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Only the requester can create a friendship
create policy "friendships_insert_requester"
  on public.friendships for insert
  with check (requester_id = auth.uid());

-- Only the addressee can update status (accept / decline)
create policy "friendships_update_addressee"
  on public.friendships for update
  using (addressee_id = auth.uid());

-- NOTIFICATION LOGS
alter table public.notification_logs enable row level security;

-- Only the edge function (service_role) can read/write notification logs
create policy "notification_logs_service_only"
  on public.notification_logs
  using (auth.role() = 'service_role');

-- ============================================================
-- HELPER FUNCTION: get_proximity_pairs()
-- Returns all accepted friendship pairs that both have a last_location,
-- along with the PostGIS distance between them.
-- Called by the proximity-check Edge Function.
-- security definer = runs as the function owner (bypasses RLS for reading users)
-- ============================================================
create or replace function public.get_proximity_pairs()
returns table (
  user_a_id          uuid,
  user_a_display_name  text,
  user_a_player_id   text,
  user_a_threshold   integer,
  user_b_id          uuid,
  user_b_display_name  text,
  user_b_player_id   text,
  user_b_threshold   integer,
  distance_meters    float
)
language plpgsql
security definer
as $$
begin
  return query
  select
    ua.id                         as user_a_id,
    ua.display_name               as user_a_display_name,
    ua.onesignal_player_id        as user_a_player_id,
    ua.distance_threshold_meters  as user_a_threshold,
    ub.id                         as user_b_id,
    ub.display_name               as user_b_display_name,
    ub.onesignal_player_id        as user_b_player_id,
    ub.distance_threshold_meters  as user_b_threshold,
    st_distance(
      ua.last_location::geography,
      ub.last_location::geography
    )                             as distance_meters
  from  public.friendships f
  join  public.users ua on ua.id = f.requester_id
  join  public.users ub on ub.id = f.addressee_id
  where f.status = 'accepted'
    and ua.last_location is not null
    and ub.last_location is not null;
end;
$$;

-- ============================================================
-- PG_CRON SCHEDULES
-- Run these manually in the Supabase SQL Editor AFTER:
--   1. Enabling pg_cron and pg_net extensions
--   2. Deploying the proximity-check Edge Function
--   3. Replacing YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY
-- ============================================================

-- Uncomment and run after setup:
/*
select cron.schedule(
  'proximity-check-morning',
  '0 8 * * *',   -- 8:00 AM UTC daily
  $$
    select net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/proximity-check',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

select cron.schedule(
  'proximity-check-evening',
  '0 20 * * *',  -- 8:00 PM UTC daily
  $$
    select net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/proximity-check',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
*/
