# Database Plan for YogaFlow Lite (PostgreSQL)

This document describes the PostgreSQL schema, indexes, and Row-Level Security (RLS) policies for the YogaFlow Lite MVP.

---

## 1. Tables

1) `users` (mirror of Supabase Auth users)

- `id uuid primary key` -- matches `auth.users.id` (not null)
- `email text` -- optional local copy for convenience (nullable)
- `created_at timestamptz default now()`

Notes: this table may be omitted if you always join to `auth.users`; included for clarity.

2) `difficulties`

- `id smallint primary key generated always as identity` -- small lookup id
- `name text not null unique` -- e.g., 'beginner', 'intermediate'

3) `pose_types`

- `id smallint primary key generated always as identity`
- `name text not null unique` -- e.g., 'standing', 'seated'

4) `poses` (canonical pose records)

- `id uuid primary key`
- `name text not null`
- `sanskrit_name text`
- `description text`
- `difficulty_id smallint references difficulties(id)`
- `type_id smallint references pose_types(id)`
- `image_url text` -- store path/URL to Supabase Storage/CDN
- `image_alt text` -- accessibility text
- `image_license text` -- license/attribution metadata
- `current_version_id uuid` references `pose_versions(id)` -- optional pointer to latest version
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- `tsv tsvector generated always as (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(sanskrit_name,'') || ' ' || coalesce(description,''))) stored`

Notes: `poses` contains the canonical, editable record. Historical snapshots are stored in `pose_versions`.

5) `pose_versions` (immutable snapshots)

- `id uuid primary key default gen_random_uuid()`
- `pose_id uuid not null references poses(id) on delete cascade`
- `version int not null` -- incremental version number
- `name text not null`
- `sanskrit_name text`
- `description text`
- `image_url text`
- `created_at timestamptz default now()`

unique constraint: (`pose_id`, `version`)

Rationale: store immutable snapshots so sequences referencing a pose keep correct historical content.

6) `sequences`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null` references `users(id)`
- `name text not null`
- `visibility text not null default 'private'` -- check constraint (private only for MVP)
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

unique constraint: (`user_id`, `name`)

7) `sequence_poses` (associative table preserving order)

- `id uuid primary key default gen_random_uuid()`
- `sequence_id uuid not null references sequences(id) on delete cascade`
- `pose_id uuid not null references poses(id)`
- `pose_version_id uuid not null references pose_versions(id)`
- `position int not null` -- integer ordering (dense positions)
- `added_at timestamptz default now()`

constraints:
- unique (`sequence_id`, `position`)

Notes: we use an `id` PK to allow duplicate poses in a sequence; uniqueness is enforced on (`sequence_id`, `position`).

8) `practice_sessions`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references users(id)`
- `sequence_id uuid not null references sequences(id)`
- `started_at timestamptz not null`
- `ended_at timestamptz` -- nullable until finished
- `duration_sec int` -- optional, can be computed or stored

optional unique constraint to enforce idempotency: (`user_id`, `sequence_id`, `started_at`)

---

## 2. Relationships (cardinality)

- `users` 1 --- * `sequences` (one user can have many sequences)
- `sequences` 1 --- * `sequence_poses` (one sequence has many pose entries)
- `poses` 1 --- * `pose_versions` (one pose can have many versions)
- `poses` 1 --- * `sequence_poses` (canonical pose referenced in sequence entries)
- `pose_versions` 1 --- * `sequence_poses` (sequence entries reference a specific pose version)
- `users` 1 --- * `practice_sessions` (one user can have many practice sessions)
- `sequences` 1 --- * `practice_sessions` (one sequence can have many sessions)

Many-to-many is modeled via `sequence_poses` (sequence ↔ pose with ordering)

---

## 3. Indexes

- `poses`: `CREATE INDEX idx_poses_tsv ON poses USING gin(tsv);` (full-text search)
- `poses`: `CREATE INDEX idx_poses_difficulty ON poses(difficulty_id);`
- `poses`: `CREATE INDEX idx_poses_type ON poses(type_id);`
- `sequence_poses`: `CREATE INDEX idx_sequence_poses_sequence_position ON sequence_poses(sequence_id, position);`
- `sequence_poses`: `CREATE INDEX idx_sequence_poses_pose ON sequence_poses(pose_id);`
- `sequences`: `CREATE INDEX idx_sequences_user ON sequences(user_id);`
- `practice_sessions`: `CREATE INDEX idx_practice_user_started ON practice_sessions(user_id, started_at);`

Notes:
- Use `gin` on the `tsv` column to accelerate full-text search across `name`, `sanskrit_name`, and `description`.
- Keep indexes minimal for MVP; add composite indexes later based on slow queries.

---

## 4. PostgreSQL / Supabase RLS Policies (examples)

-- Enable RLS on user-protected tables
```sql
alter table sequences enable row level security;
alter table sequence_poses enable row level security;
alter table practice_sessions enable row level security;
alter table pose_versions enable row level security;
```

-- sequences: allow users to select/insert/update/delete only their own sequences
```sql
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
```

-- sequence_poses: allow access if the parent sequence belongs to the user
```sql
create policy "select_sequence_poses_if_owner" on sequence_poses
  for select
  using (exists (
    select 1 from sequences s where s.id = sequence_poses.sequence_id and s.user_id = auth.uid()
  ));

create policy "insert_sequence_pose_if_owner" on sequence_poses
  for insert
  with check (exists (
    select 1 from sequences s where s.id = new.sequence_id and s.user_id = auth.uid()
  ));

create policy "update_sequence_pose_if_owner" on sequence_poses
  for update
  using (exists (
    select 1 from sequences s where s.id = sequence_poses.sequence_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from sequences s where s.id = new.sequence_id and s.user_id = auth.uid()
  ));

create policy "delete_sequence_pose_if_owner" on sequence_poses
  for delete
  using (exists (
    select 1 from sequences s where s.id = sequence_poses.sequence_id and s.user_id = auth.uid()
  ));
```

-- practice_sessions: user can only read/insert their own sessions
```sql
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
```

-- pose_versions: read access only to authenticated users for MVP
```sql
create policy "select_pose_versions_auth" on pose_versions
  for select
  using (auth.uid() is not null);

create policy "insert_pose_versions_admin_only" on pose_versions
  for insert
  with check (current_setting('jwt.claims.role', true) = 'admin');
```

Notes on admin/service roles:
- Supabase `service_role` bypasses RLS when used server-side; for role-based policies in the database, a common pattern is to check a JWT claim like `jwt.claims.role = 'admin'` to allow admin actions. Adjust the exact check to match your auth token claims.

---

## 5. Additional Notes & Design Decisions

- IDs: use `uuid` for primary keys (use `gen_random_uuid()` from `pgcrypto`) to align with Supabase Auth.
- Ordering: `position int` is used for ordering within `sequence_poses`. Reordering should be performed server-side in a single transaction using `SELECT ... FOR UPDATE` on affected `sequence_poses` rows; renumber in batches if necessary.
- Images: store only references (`image_url`) and metadata in DB; keep files in Supabase Storage or CDN.
- Full-text search: `tsv` generated column + GIN index for searching across names and description.
- No soft deletes for MVP. Use `on delete cascade`/`set null` policies conservatively; prefer non-destructive behavior when possible.
- Volume: expected small (<<1000 practice_sessions/month) — no partitioning needed for MVP; monitor and add partitioning for `practice_sessions` later if volumes increase.

---

## 6. Example SQL snippets for table creation (abbreviated)

```sql
create extension if not exists pgcrypto;

create table difficulties (
  id smallint primary key generated always as identity,
  name text not null unique
);

create table pose_types (
  id smallint primary key generated always as identity,
  name text not null unique
);

create table poses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sanskrit_name text,
  description text,
  difficulty_id smallint references difficulties(id),
  type_id smallint references pose_types(id),
  image_url text,
  image_alt text,
  image_license text,
  current_version_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  tsv tsvector generated always as (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(sanskrit_name,'') || ' ' || coalesce(description,''))) stored
);

alter table poses add constraint fk_current_version foreign key (current_version_id) references pose_versions(id);
```

---

End of plan.


