-- Keys for the MCP endpoint (/api/mcp): an AI client acts as the key's owner, with exactly that person's permissions.
-- Like sessions, only a SHA-256 of the key is stored; the key itself is shown once, when it is made.

create table api_tokens (
  id char(36) not null primary key default (uuid()),
  user_id char(36) not null,
  name varchar(80) not null,
  token_hash varchar(64) not null unique,
  -- The first characters of the key ("cno_AbCd"), so its owner can tell keys apart without the key.
  prefix varchar(12) not null,
  created_at datetime(3) not null default current_timestamp(3),
  last_used_at datetime(3) null,
  expires_at datetime(3) not null,
  revoked_at datetime(3) null,
  constraint api_tokens_user_fk foreign key (user_id) references users (id) on delete cascade,
  constraint api_tokens_name_len check (char_length(name) between 2 and 80),
  index api_tokens_user_idx (user_id)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

-- What was done through a key: one row per tool call that changes something (or was refused), for the owner to review.
create table mcp_calls (
  id bigint not null auto_increment primary key,
  token_id char(36) not null,
  tool varchar(80) not null,
  ok boolean not null,
  error varchar(300) null,
  created_at datetime(3) not null default current_timestamp(3),
  constraint mcp_calls_token_fk foreign key (token_id) references api_tokens (id) on delete cascade,
  index mcp_calls_created_idx (created_at)
) default charset utf8mb4 collate utf8mb4_unicode_ci;
