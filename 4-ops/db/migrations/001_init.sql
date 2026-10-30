-- Coder Nation Ops, phase 1: team accounts, CRM (clients, deals, activities, follow-ups) and proposals.
-- Money is stored as integers in the currency's smallest unit (piastres, cents, halalas...), never as floats.

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text not null check (char_length(name) between 2 and 80),
  role text not null check (role in ('owner', 'manager', 'employee')),
  password_hash text not null,
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- The browser holds a random token; only its SHA-256 is stored.
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300)
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expires_idx on sessions (expires_at);

create table rate_limits (
  key text primary key,
  count integer not null,
  window_start timestamptz not null
);

-- One row: the company details printed on proposals.
create table company_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default '',
  address text not null default '',
  email text not null default '',
  phone text not null default '',
  tax_number text not null default '',
  updated_at timestamptz not null default now()
);
insert into company_settings (id, name) values (1, 'Coder Nation');

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  phone text check (phone is null or char_length(phone) between 6 and 30),
  email text check (email is null or char_length(email) <= 254),
  website text check (website is null or char_length(website) <= 200),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index clients_phone_idx on clients (phone);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  job_title text check (job_title is null or char_length(job_title) <= 120),
  phone text check (phone is null or char_length(phone) between 6 and 30),
  email text check (email is null or char_length(email) <= 254),
  created_at timestamptz not null default now()
);
create index contacts_client_idx on contacts (client_id);

create table deals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete restrict,
  contact_id uuid references contacts (id) on delete set null,
  title text not null check (char_length(title) between 2 and 200),
  service text check (service is null or char_length(service) <= 80),
  stage text not null default 'new' check (stage in ('new', 'contacted', 'meeting', 'proposal_sent', 'negotiation', 'won', 'lost')),
  source text not null default 'manual' check (source in ('website', 'manual', 'referral', 'other')),
  -- Set for deals that arrive from another system (the website's lead id): makes intake idempotent.
  external_id text unique,
  value_minor bigint check (value_minor is null or value_minor >= 0),
  currency char(3) check (currency is null or currency in ('EGP', 'USD', 'SAR', 'AED', 'EUR')),
  owner_id uuid references users (id) on delete set null,
  lost_reason text check (lost_reason is null or char_length(lost_reason) between 2 and 300),
  message text check (message is null or char_length(message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage_changed_at timestamptz not null default now(),
  closed_at timestamptz,
  -- A lost deal always says why; no other stage has a reason.
  check ((stage = 'lost') = (lost_reason is not null)),
  check ((stage in ('won', 'lost')) = (closed_at is not null))
);
create index deals_stage_idx on deals (stage, stage_changed_at desc);
create index deals_owner_idx on deals (owner_id);
create index deals_client_idx on deals (client_id);

create table activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  kind text not null check (kind in ('note', 'call', 'meeting', 'whatsapp', 'email', 'stage', 'system')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index activities_deal_idx on activities (deal_id, created_at desc);

create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  assignee_id uuid references users (id) on delete set null,
  due_at timestamptz not null,
  note text not null default '' check (char_length(note) <= 500),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index follow_ups_open_idx on follow_ups (due_at) where done_at is null;

-- Proposals: numbered P-YYYY-NNNN, one counter row per year.
create table proposal_counters (
  year integer primary key,
  last integer not null
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete restrict,
  number text not null unique,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  title text not null check (char_length(title) between 2 and 200),
  currency char(3) not null check (currency in ('EGP', 'USD', 'SAR', 'AED', 'EUR')),
  -- Basis points (14% = 1400). NULL = no tax line at all.
  tax_rate_bp integer check (tax_rate_bp is null or tax_rate_bp between 0 and 10000),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  valid_until date,
  intro text not null default '' check (char_length(intro) <= 4000),
  -- [{ "title": "...", "body": "..." }] free text blocks of the technical proposal.
  sections jsonb not null default '[]'::jsonb,
  -- [{ "title": "...", "weeks": 2 }]
  timeline jsonb not null default '[]'::jsonb,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index proposals_deal_idx on proposals (deal_id);

create table proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals (id) on delete cascade,
  position integer not null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 1000),
  quantity integer not null default 1 check (quantity between 1 and 10000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 100000000000)
);
create index proposal_items_idx on proposal_items (proposal_id, position);

-- Payment schedule; percents are basis points and must add up to 10000 before a proposal can be exported.
create table proposal_milestones (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals (id) on delete cascade,
  position integer not null,
  title text not null check (char_length(title) between 1 and 200),
  percent_bp integer not null check (percent_bp between 1 and 10000)
);
create index proposal_milestones_idx on proposal_milestones (proposal_id, position);
