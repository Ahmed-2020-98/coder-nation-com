-- Images uploaded from the admin panel (portfolio screenshots). They live in the database, not on disk: the host
-- replaces its files on every deploy, and a database backup then covers the images too.

create table media (
  id char(36) not null primary key default (uuid()),
  mime varchar(20) not null,
  data mediumblob not null,
  size_bytes int not null,
  created_at datetime(3) not null default current_timestamp(3),
  constraint media_mime_ok check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  constraint media_size_ok check (size_bytes between 1 and 2097152),
  constraint media_size_matches check (octet_length(data) = size_bytes),
  index media_created_idx (created_at)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

-- The editable page texts are one more JSON document in `settings`, under the name 'content' (validated by the app).
