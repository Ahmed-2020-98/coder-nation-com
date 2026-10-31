-- Phase 3: attendance. One shift per tracked person, one check-in/check-out pair per day, leaves entered by managers,
-- and an audit trail for every manual change to a day's record.

-- A person is "tracked" when they have a shift row; people without one (e.g. the owner) are simply not part of attendance.
create table work_schedules (
  user_id char(36) not null primary key,
  start_time time not null,
  end_time time not null,
  -- A JSON array of weekday numbers: 0 = Sunday ... 6 = Saturday.
  work_days json not null,
  grace_minutes int not null default 15,
  -- Absences are only counted from this day on, so adding someone later doesn't invent a month of absence.
  -- The app sets it to today's date in Cairo; the default is only a fallback for hand-written inserts.
  tracked_since date not null default (utc_date()),
  updated_at datetime(3) not null default current_timestamp(3),
  constraint work_schedules_user_fk foreign key (user_id) references users (id) on delete cascade,
  constraint work_schedules_days_ok check (json_valid(work_days) and json_length(work_days) between 1 and 7 and json_contains(json_array(0, 1, 2, 3, 4, 5, 6), work_days)),
  constraint work_schedules_grace_ok check (grace_minutes between 0 and 120),
  constraint work_schedules_times_ok check (end_time > start_time)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table attendance (
  id char(36) not null primary key default (uuid()),
  user_id char(36) not null,
  -- The office's calendar day (Cairo), decided by the server clock.
  work_date date not null,
  check_in datetime(3) not null,
  check_out datetime(3) null,
  -- Minutes after shift start when the person was later than the grace period; 0 otherwise. Stored at check-in so a later
  -- change of shift doesn't rewrite history.
  late_minutes int not null default 0,
  created_at datetime(3) not null default current_timestamp(3),
  constraint attendance_user_fk foreign key (user_id) references users (id) on delete cascade,
  constraint attendance_late_ok check (late_minutes >= 0),
  constraint attendance_times_ok check (check_out is null or check_out > check_in),
  unique key attendance_user_day (user_id, work_date),
  index attendance_date_idx (work_date)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table attendance_edits (
  id char(36) not null primary key default (uuid()),
  -- Whose day was changed, and which day. Not a foreign key to attendance: the trail must survive a deleted record.
  user_id char(36) not null,
  work_date date not null,
  edited_by char(36) null,
  action varchar(10) not null,
  reason varchar(300) not null,
  old_check_in datetime(3) null,
  old_check_out datetime(3) null,
  new_check_in datetime(3) null,
  new_check_out datetime(3) null,
  created_at datetime(3) not null default current_timestamp(3),
  constraint attendance_edits_action_ok check (action in ('create', 'update', 'delete')),
  constraint attendance_edits_reason_len check (char_length(reason) between 2 and 300),
  constraint attendance_edits_user_fk foreign key (user_id) references users (id) on delete cascade,
  constraint attendance_edits_by_fk foreign key (edited_by) references users (id) on delete set null,
  index attendance_edits_user_idx (user_id, work_date)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table leaves (
  id char(36) not null primary key default (uuid()),
  user_id char(36) not null,
  kind varchar(20) not null,
  start_date date not null,
  end_date date not null,
  note varchar(300) not null default '',
  created_by char(36) null,
  created_at datetime(3) not null default current_timestamp(3),
  constraint leaves_kind_ok check (kind in ('annual', 'sick', 'unpaid', 'official', 'other')),
  constraint leaves_dates_ok check (end_date >= start_date),
  constraint leaves_length_ok check (datediff(end_date, start_date) <= 365),
  constraint leaves_user_fk foreign key (user_id) references users (id) on delete cascade,
  constraint leaves_created_by_fk foreign key (created_by) references users (id) on delete set null,
  index leaves_user_idx (user_id, start_date, end_date)
) default charset utf8mb4 collate utf8mb4_unicode_ci;
