-- Phase 2: projects and tasks. A project usually starts from a won deal; a task may or may not belong to a project.

create table projects (
  id char(36) not null primary key default (uuid()),
  -- NULL for an internal project that has no client.
  client_id char(36) null,
  deal_id char(36) null,
  proposal_id char(36) null,
  name varchar(200) not null,
  status varchar(20) not null default 'active',
  manager_id char(36) null,
  start_date date not null default (utc_date()),
  due_date date null,
  notes varchar(4000) not null default '',
  created_by char(36) null,
  created_at datetime(3) not null default current_timestamp(3),
  closed_at datetime(3) null,
  constraint projects_name_len check (char_length(name) between 2 and 200),
  constraint projects_status_ok check (status in ('active', 'on_hold', 'done', 'cancelled')),
  constraint projects_dates_ok check (due_date is null or due_date >= start_date),
  constraint projects_closed_when_final check ((status in ('done', 'cancelled')) = (closed_at is not null)),
  constraint projects_client_fk foreign key (client_id) references clients (id) on delete restrict,
  constraint projects_deal_fk foreign key (deal_id) references deals (id) on delete set null,
  constraint projects_proposal_fk foreign key (proposal_id) references proposals (id) on delete set null,
  constraint projects_manager_fk foreign key (manager_id) references users (id) on delete set null,
  constraint projects_created_by_fk foreign key (created_by) references users (id) on delete set null,
  -- One project per proposal: starting the same accepted proposal twice would duplicate every task.
  -- (A unique index allows any number of NULLs, so projects without a proposal are not affected.)
  unique index projects_proposal_unique (proposal_id),
  index projects_client_idx (client_id)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table tasks (
  id char(36) not null primary key default (uuid()),
  project_id char(36) null,
  title varchar(200) not null,
  description varchar(4000) not null default '',
  status varchar(20) not null default 'todo',
  blocked_reason varchar(300) null,
  priority varchar(20) not null default 'normal',
  assignee_id char(36) null,
  due_date date null,
  deal_id char(36) null,
  client_id char(36) null,
  created_by char(36) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3),
  completed_at datetime(3) null,
  constraint tasks_title_len check (char_length(title) between 2 and 200),
  constraint tasks_status_ok check (status in ('todo', 'doing', 'review', 'done', 'blocked')),
  constraint tasks_priority_ok check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint tasks_reason_len check (blocked_reason is null or char_length(blocked_reason) between 2 and 300),
  -- A blocked task always says why; no other status has a reason. A done task always has its completion time.
  constraint tasks_blocked_has_reason check ((status = 'blocked') = (blocked_reason is not null)),
  constraint tasks_done_has_time check ((status = 'done') = (completed_at is not null)),
  constraint tasks_project_fk foreign key (project_id) references projects (id) on delete restrict,
  constraint tasks_assignee_fk foreign key (assignee_id) references users (id) on delete set null,
  constraint tasks_deal_fk foreign key (deal_id) references deals (id) on delete set null,
  constraint tasks_client_fk foreign key (client_id) references clients (id) on delete set null,
  constraint tasks_created_by_fk foreign key (created_by) references users (id) on delete set null,
  index tasks_assignee_idx (assignee_id, status),
  index tasks_project_idx (project_id),
  index tasks_due_idx (due_date)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table task_events (
  id char(36) not null primary key default (uuid()),
  task_id char(36) not null,
  user_id char(36) null,
  kind varchar(20) not null,
  body varchar(4000) not null,
  created_at datetime(3) not null default current_timestamp(3),
  constraint task_events_kind_ok check (kind in ('comment', 'status', 'assign', 'system')),
  constraint task_events_body_len check (char_length(body) between 1 and 4000),
  constraint task_events_task_fk foreign key (task_id) references tasks (id) on delete cascade,
  constraint task_events_user_fk foreign key (user_id) references users (id) on delete set null,
  index task_events_task_idx (task_id, created_at)
) default charset utf8mb4 collate utf8mb4_unicode_ci;
