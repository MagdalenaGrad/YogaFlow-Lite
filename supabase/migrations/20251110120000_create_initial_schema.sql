-- Migration: Create initial schema for YogaFlow Lite
-- Purpose: Create all tables, indexes, and RLS policies for MVP
-- Affected tables: users, difficulties, pose_types, poses, pose_versions, sequences, sequence_poses, practice_sessions
-- Special considerations: 
--   - RLS enabled on all user-sensitive tables
--   - Full-text search on poses using tsvector
--   - pose_versions preserves immutable snapshots for historical integrity

-- Enable required extensions
create extension if not exists pgcrypto;

-- ============================================================================
-- LOOKUP TABLES
-- ============================================================================

-- difficulties: lookup table for pose difficulty levels
create table difficulties (
  id smallint primary key generated always as identity,
  name text not null unique
);

comment on table difficulties is 'Lookup table for pose difficulty levels (e.g., beginner, intermediate, advanced)';

-- pose_types: lookup table for pose categories
create table pose_types (
  id smallint primary key generated always as identity,
  name text not null unique
);

comment on table pose_types is 'Lookup table for pose categories (e.g., standing, seated, balancing)';

-- ============================================================================
-- USER TABLE
-- ============================================================================

-- users: mirror of auth.users for local reference
-- This table is automatically synced with auth.users via trigger
create table users (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now()
);

comment on table users is 'Local mirror of Supabase auth.users for reference; automatically synced via trigger';

-- Trigger function to sync new users from auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger to automatically create user record when auth user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- POSE TABLES
-- ============================================================================

-- poses: canonical pose records (editable)
create table poses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sanskrit_name text,
  description text,
  difficulty_id smallint references difficulties(id),
  type_id smallint references pose_types(id),
  image_url text,
  image_alt text not null,
  image_license text,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- generated full-text search vector
  tsv tsvector generated always as (
    to_tsvector('simple', 
      coalesce(name, '') || ' ' || 
      coalesce(sanskrit_name, '') || ' ' || 
      coalesce(description, '')
    )
  ) stored
);

comment on table poses is 'Canonical pose records with current metadata; historical snapshots in pose_versions';
comment on column poses.tsv is 'Generated tsvector for full-text search across name, sanskrit_name, and description';
comment on column poses.image_alt is 'Accessibility: alt text required for WCAG compliance';

-- pose_versions: immutable snapshots of pose content
create table pose_versions (
  id uuid primary key default gen_random_uuid(),
  pose_id uuid not null references poses(id) on delete cascade,
  version int not null,
  name text not null,
  sanskrit_name text,
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  constraint unique_pose_version unique (pose_id, version)
);

comment on table pose_versions is 'Immutable snapshots of pose content; referenced by sequence_poses to preserve historical integrity';

-- Add foreign key from poses to pose_versions (circular reference resolved after both tables exist)
alter table poses 
  add constraint fk_current_version 
  foreign key (current_version_id) 
  references pose_versions(id);

-- ============================================================================
-- SEQUENCE TABLES
-- ============================================================================

-- sequences: user-created practice sequences
create table sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  name text not null,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_user_sequence_name unique (user_id, name)
);

comment on table sequences is 'User-created practice sequences; private by default for MVP';
comment on column sequences.visibility is 'MVP uses private only; unlisted/public reserved for future sharing features';

-- sequence_poses: associative table linking sequences to poses with ordering
create table sequence_poses (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id) on delete cascade,
  pose_id uuid not null references poses(id),
  pose_version_id uuid not null references pose_versions(id),
  position int not null,
  added_at timestamptz not null default now(),
  constraint unique_sequence_position unique (sequence_id, position)
);

comment on table sequence_poses is 'Many-to-many: sequences to poses with ordering; allows duplicate poses in a sequence';
comment on column sequence_poses.position is 'Integer position for ordering; reorder server-side in transaction with SELECT FOR UPDATE';
comment on column sequence_poses.pose_version_id is 'References immutable snapshot to preserve historical content if pose is edited';

-- ============================================================================
-- PRACTICE SESSION TABLE
-- ============================================================================

-- practice_sessions: analytics for practice mode usage
create table practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  sequence_id uuid not null references sequences(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec int,
  constraint unique_practice_start unique (user_id, sequence_id, started_at)
);

comment on table practice_sessions is 'Analytics for practice mode; append-only for KPI tracking';
comment on column practice_sessions.duration_sec is 'Can be computed from started_at/ended_at or stored for convenience';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Full-text search on poses
create index idx_poses_tsv on poses using gin(tsv);

-- Filter indexes on poses
create index idx_poses_difficulty on poses(difficulty_id);
create index idx_poses_type on poses(type_id);

-- Composite index for sequence pose ordering
create index idx_sequence_poses_sequence_position on sequence_poses(sequence_id, position);

-- Index for looking up which sequences contain a pose
create index idx_sequence_poses_pose on sequence_poses(pose_id);

-- Index for user's sequences
create index idx_sequences_user on sequences(user_id);

-- Index for practice analytics queries
create index idx_practice_user_started on practice_sessions(user_id, started_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables (authenticated-only access per decision #10)
alter table users enable row level security;
alter table difficulties enable row level security;
alter table pose_types enable row level security;
alter table poses enable row level security;
alter table pose_versions enable row level security;
alter table sequences enable row level security;
alter table sequence_poses enable row level security;
alter table practice_sessions enable row level security;

-- ============================================================================
-- RLS POLICIES: users (read own profile)
-- ============================================================================

-- users: can read own profile
create policy "select_own_user" on users
  for select
  using (id = auth.uid());

-- ============================================================================
-- RLS POLICIES: lookup tables (authenticated read, admin write)
-- ============================================================================

-- difficulties: authenticated users can read
create policy "select_difficulties_auth" on difficulties
  for select
  using (auth.uid() is not null);

-- pose_types: authenticated users can read
create policy "select_pose_types_auth" on pose_types
  for select
  using (auth.uid() is not null);

-- ============================================================================
-- RLS POLICIES: poses (authenticated read, admin write)
-- ============================================================================

-- poses: authenticated users can read
create policy "select_poses_auth" on poses
  for select
  using (auth.uid() is not null);

-- poses: admin-only insert (use service_role for admin operations)
create policy "insert_poses_admin_only" on poses
  for insert
  with check (
    coalesce(
      current_setting('request.jwt.claims', true)::json->>'role',
      ''
    ) = 'admin'
  );

-- poses: admin-only update
create policy "update_poses_admin_only" on poses
  for update
  using (
    coalesce(
      current_setting('request.jwt.claims', true)::json->>'role',
      ''
    ) = 'admin'
  );

-- poses: admin-only delete
create policy "delete_poses_admin_only" on poses
  for delete
  using (
    coalesce(
      current_setting('request.jwt.claims', true)::json->>'role',
      ''
    ) = 'admin'
  );

-- ============================================================================
-- RLS POLICIES: sequences
-- ============================================================================

-- sequences: users can only access their own sequences

create policy "select_own_sequences" on sequences
  for select
  using (user_id = auth.uid());

create policy "insert_sequences" on sequences
  for insert
  with check (user_id = auth.uid());

create policy "update_own_sequences" on sequences
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "delete_own_sequences" on sequences
  for delete
  using (user_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: sequence_poses
-- ============================================================================

-- sequence_poses: users can access poses if they own the parent sequence

create policy "select_sequence_poses_if_owner" on sequence_poses
  for select
  using (
    exists (
      select 1 from sequences s 
      where s.id = sequence_poses.sequence_id 
        and s.user_id = auth.uid()
    )
  );

create policy "insert_sequence_pose_if_owner" on sequence_poses
  for insert
  with check (
    exists (
      select 1 from sequences s 
      where s.id = sequence_poses.sequence_id 
        and s.user_id = auth.uid()
    )
  );

create policy "update_sequence_pose_if_owner" on sequence_poses
  for update
  using (
    exists (
      select 1 from sequences s 
      where s.id = sequence_poses.sequence_id 
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sequences s 
      where s.id = sequence_poses.sequence_id 
        and s.user_id = auth.uid()
    )
  );

create policy "delete_sequence_pose_if_owner" on sequence_poses
  for delete
  using (
    exists (
      select 1 from sequences s 
      where s.id = sequence_poses.sequence_id 
        and s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: practice_sessions
-- ============================================================================

-- practice_sessions: users can only access their own sessions

create policy "select_own_practice_sessions" on practice_sessions
  for select
  using (user_id = auth.uid());

create policy "insert_practice_sessions" on practice_sessions
  for insert
  with check (user_id = auth.uid());

create policy "update_own_practice_sessions" on practice_sessions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "delete_own_practice_sessions" on practice_sessions
  for delete
  using (user_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: pose_versions
-- ============================================================================

-- pose_versions: authenticated users can read; only admins can write

create policy "select_pose_versions_auth" on pose_versions
  for select
  using (auth.uid() is not null);

-- Admin-only write policies for pose_versions
create policy "insert_pose_versions_admin_only" on pose_versions
  for insert
  with check (
    coalesce(
      current_setting('request.jwt.claims', true)::json->>'role',
      ''
    ) = 'admin'
  );

create policy "update_pose_versions_admin_only" on pose_versions
  for update
  using (
    coalesce(
      current_setting('request.jwt.claims', true)::json->>'role',
      ''
    ) = 'admin'
  );

create policy "delete_pose_versions_admin_only" on pose_versions
  for delete
  using (
    coalesce(
      current_setting('request.jwt.claims', true)::json->>'role',
      ''
    ) = 'admin'
  );

-- ============================================================================
-- SEED DATA: Lookup Tables
-- ============================================================================

-- Seed difficulties
insert into difficulties (name) values
  ('beginner'),
  ('intermediate'),
  ('advanced');

-- Seed pose_types
insert into pose_types (name) values
  ('standing'),
  ('seated'),
  ('balancing'),
  ('backbend'),
  ('forward_bend'),
  ('twist'),
  ('inversion'),
  ('resting');

comment on table difficulties is 'Seeded with beginner, intermediate, advanced';
comment on table pose_types is 'Seeded with common yoga pose categories';

