-- Employee contracts. A template holds one job's clauses; a contract copies them for one team member, who reads it and
-- accepts (or declines) from their own account. Once accepted it can never change: a revision is a new contract.

create table contract_templates (
  id char(36) not null primary key default (uuid()),
  title varchar(200) not null,
  job_title varchar(120) not null,
  -- A JSON array of {title, body}. Bodies may hold tokens such as {بداية_العمل}, filled from the contract's own fields.
  clauses json not null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3),
  constraint contract_templates_title_len check (char_length(title) between 2 and 200),
  constraint contract_templates_clauses_ok check (json_valid(clauses) and json_type(clauses) = 'ARRAY')
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table contract_counters (
  year int not null primary key,
  last_number int not null
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table contracts (
  id char(36) not null primary key default (uuid()),
  number varchar(20) not null unique,
  -- The team member it is for: they are the only one besides the owner who can open it, and the one who accepts it.
  user_id char(36) not null,
  template_id char(36) null,
  status varchar(20) not null default 'draft',
  title varchar(200) not null,
  employee_name varchar(120) not null,
  job_title varchar(120) not null,
  phone varchar(30) not null default '',
  email varchar(254) not null default '',
  national_id varchar(20) not null default '',
  address varchar(300) not null default '',
  start_date date null,
  work_start time not null,
  work_end time not null,
  -- A JSON array of weekday numbers: 0 = Sunday ... 6 = Saturday (same as work_schedules).
  work_days json not null,
  salary_minor bigint null,
  currency char(3) not null default 'EGP',
  commission varchar(500) not null default '',
  clauses json not null,
  sent_at datetime(3) null,
  responded_at datetime(3) null,
  decline_reason varchar(500) not null default '',
  -- Evidence of the acceptance: a keyed hash of the IP (never the address itself) and the browser.
  response_ip_hash varchar(64) null,
  response_user_agent varchar(300) null,
  created_by char(36) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3),
  constraint contracts_user_fk foreign key (user_id) references users (id),
  constraint contracts_template_fk foreign key (template_id) references contract_templates (id) on delete set null,
  constraint contracts_created_by_fk foreign key (created_by) references users (id) on delete set null,
  constraint contracts_status_ok check (status in ('draft', 'sent', 'accepted', 'declined')),
  constraint contracts_name_len check (char_length(employee_name) between 2 and 120),
  constraint contracts_days_ok check (json_valid(work_days) and json_length(work_days) <= 7 and json_contains(json_array(0, 1, 2, 3, 4, 5, 6), work_days)),
  constraint contracts_times_ok check (work_end > work_start),
  constraint contracts_salary_ok check (salary_minor is null or salary_minor >= 0),
  constraint contracts_clauses_ok check (json_valid(clauses) and json_type(clauses) = 'ARRAY'),
  constraint contracts_sent_ok check (status = 'draft' or sent_at is not null),
  constraint contracts_response_ok check (status not in ('accepted', 'declined') or responded_at is not null),
  index contracts_user_idx (user_id, status),
  index contracts_created_idx (created_at)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

-- The first template: the sales / client-relations role, with the two clauses agreed so far. More are added from the app.
insert into contract_templates (id, title, job_title, clauses) values (
  uuid(),
  'اتفاق عمل — مبيعات وإدارة علاقات العملاء',
  'مبيعات وإدارة علاقات العملاء',
  json_array(
    json_object(
      'title', 'المهام',
      'body', concat_ws('\n',
        '- الرد على استفسارات العملاء الواردة من قنوات التسويق خلال المدة المتفق عليها.',
        '- فهم احتياج العميل وتسجيله بشكل واضح.',
        '- ترتيب وإدارة الاجتماعات مع العملاء، وعرض الأعمال السابقة أو الديمو.',
        '- الرد على اعتراضات العميل والتفاوض في حدود الصلاحيات الواردة في البند الرابع.',
        '- إقفال الصفقة واستلام العربون.',
        '- تحديث حالة كل عميل في نظام المتابعة (Notion).')
    ),
    json_object(
      'title', 'مواعيد وأيام العمل',
      'body', 'من الساعة {بداية_العمل} إلى الساعة {نهاية_العمل}، أيام: {أيام_العمل}.'
    )
  )
);
