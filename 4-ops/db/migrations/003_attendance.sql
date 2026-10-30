-- Phase 3: attendance. One shift per tracked person, one check-in/check-out pair per day, leaves entered by managers,
-- and an audit trail for every manual change to a day's record.

-- A person is "tracked" when they have a shift row; people without one (e.g. the owner) are simply not part of attendance.
create table work_schedules (
  user_id uuid primary key references users (id) on delete cascade,
  start_time time not null,
  end_time time not null,
  -- 0 = Sunday ... 6 = Saturday
  work_days smallint[] not null check (cardinality(work_days) between 1 and 7 and work_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  grace_minutes integer not null default 15 check (grace_minutes between 0 and 120),
  -- Absences are only counted from this day on, so adding someone later doesn't invent a month of absence.
  tracked_since date not null default ((now() at time zone 'Africa/Cairo')::date),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  -- The office's calendar day (Cairo), decided by the server clock.
  work_date date not null,
  check_in timestamptz not null,
  check_out timestamptz,
  -- Minutes after shift start when the person was later than the grace period; 0 otherwise. Stored at check-in so a later
  -- change of shift doesn't rewrite history.
  late_minutes integer not null default 0 check (late_minutes >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, work_date),
  check (check_out is null or check_out > check_in)
);
create index attendance_date_idx on attendance (work_date);

create table attendance_edits (
  id uuid primary key default gen_random_uuid(),
  -- Whose day was changed, and which day. Not a foreign key to attendance: the trail must survive a deleted record.
  user_id uuid not null references users (id) on delete cascade,
  work_date date not null,
  edited_by uuid references users (id) on delete set null,
  action text not null check (action in ('create', 'update', 'delete')),
  reason text not null check (char_length(reason) between 2 and 300),
  old_check_in timestamptz,
  old_check_out timestamptz,
  new_check_in timestamptz,
  new_check_out timestamptz,
  created_at timestamptz not null default now()
);
create index attendance_edits_user_idx on attendance_edits (user_id, work_date);

create table leaves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('annual', 'sick', 'unpaid', 'official', 'other')),
  start_date date not null,
  end_date date not null,
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 365)
);
create index leaves_user_idx on leaves (user_id, start_date, end_date);
