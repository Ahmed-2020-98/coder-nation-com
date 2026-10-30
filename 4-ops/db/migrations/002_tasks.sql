-- Phase 2: projects and tasks. A project usually starts from a won deal; a task may or may not belong to a project.

create table projects (
  id uuid primary key default gen_random_uuid(),
  -- NULL for an internal project that has no client.
  client_id uuid references clients (id) on delete restrict,
  deal_id uuid references deals (id) on delete set null,
  proposal_id uuid references proposals (id) on delete set null,
  name text not null check (char_length(name) between 2 and 200),
  status text not null default 'active' check (status in ('active', 'on_hold', 'done', 'cancelled')),
  manager_id uuid references users (id) on delete set null,
  start_date date not null default current_date,
  due_date date,
  notes text not null default '' check (char_length(notes) <= 4000),
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check (due_date is null or due_date >= start_date),
  check ((status in ('done', 'cancelled')) = (closed_at is not null))
);
-- One project per proposal: starting the same accepted proposal twice would duplicate every task.
create unique index projects_proposal_unique on projects (proposal_id) where proposal_id is not null;
create index projects_client_idx on projects (client_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete restrict,
  title text not null check (char_length(title) between 2 and 200),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done', 'blocked')),
  blocked_reason text check (blocked_reason is null or char_length(blocked_reason) between 2 and 300),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_id uuid references users (id) on delete set null,
  due_date date,
  deal_id uuid references deals (id) on delete set null,
  client_id uuid references clients (id) on delete set null,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  -- A blocked task always says why; no other status has a reason. A done task always has its completion time.
  check ((status = 'blocked') = (blocked_reason is not null)),
  check ((status = 'done') = (completed_at is not null))
);
create index tasks_assignee_idx on tasks (assignee_id, status);
create index tasks_project_idx on tasks (project_id);
create index tasks_due_idx on tasks (due_date) where status <> 'done';

create table task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  kind text not null check (kind in ('comment', 'status', 'assign', 'system')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index task_events_task_idx on task_events (task_id, created_at desc);
