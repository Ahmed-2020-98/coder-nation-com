-- Images uploaded from the admin panel (portfolio screenshots). They live in the database, not on disk: the host
-- replaces its files on every deploy, and a database backup then covers the images too.

create table media (
  id uuid primary key default gen_random_uuid(),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  data bytea not null,
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  created_at timestamptz not null default now(),
  check (octet_length(data) = size_bytes)
);
create index media_created_idx on media (created_at);

-- The editable page texts are one more JSON document in `settings`, under the key 'content' (validated by the app).
