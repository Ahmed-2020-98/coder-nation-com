-- Coder Nation site: leads from the contact form, site settings, admin accounts and sessions.

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 30),
  email text check (email is null or char_length(email) <= 254),
  service text check (service is null or char_length(service) <= 80),
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  note text not null default '' check (char_length(note) <= 2000),
  source text not null default 'website',
  -- HMAC of the visitor's IP with a server secret: enough to spot repeats, useless to identify anyone.
  ip_hash text,
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_status_created_idx on leads (status, created_at desc);
create index leads_created_idx on leads (created_at desc);

-- One JSON document under the key 'site' (validated by the app before it is written).
create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- The browser holds a random token; only its SHA-256 is stored, so a leaked table cannot be replayed.
create table sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300)
);
create index sessions_admin_idx on sessions (admin_id);
create index sessions_expires_idx on sessions (expires_at);

-- Fixed-window counters for the public form and the login (see src/server/rate-limit.ts).
create table rate_limits (
  key text primary key,
  count integer not null,
  window_start timestamptz not null
);
