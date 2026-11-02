-- Client contracts and invoices. An accepted proposal becomes a contract: it keeps its own copy of the proposal's
-- scope, prices and payment schedule, plus legal clauses from a template, and is printed and signed by hand. Every
-- payment the client sends is recorded against the contract and gets its own numbered invoice (an internal document,
-- not an e-invoice). Invoices are never deleted: a mistake is voided with a reason and its number stays taken.

create table client_contract_templates (
  id char(36) not null primary key default (uuid()),
  title varchar(200) not null,
  -- A JSON array of {title, body}. Bodies may hold tokens such as {إجمالي_العقد}, filled from the contract.
  clauses json not null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3),
  constraint client_contract_templates_title_len check (char_length(title) between 2 and 200),
  constraint client_contract_templates_clauses_ok check (json_valid(clauses) and json_type(clauses) = 'ARRAY')
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table client_contract_counters (
  year int not null primary key,
  last_number int not null
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table client_contracts (
  id char(36) not null primary key default (uuid()),
  number varchar(20) not null unique,
  proposal_id char(36) not null,
  deal_id char(36) not null,
  client_id char(36) not null,
  template_id char(36) null,
  status varchar(20) not null default 'draft',
  title varchar(200) not null,
  client_name varchar(160) not null,
  client_representative varchar(120) not null default '',
  -- Commercial register or national id: whatever identifies the client on paper.
  client_id_number varchar(40) not null default '',
  client_address varchar(300) not null default '',
  client_phone varchar(30) not null default '',
  client_email varchar(254) not null default '',
  start_date date null,
  -- Copied from the proposal when the contract is made, so a later proposal never changes what was signed.
  currency char(3) not null,
  items json not null,
  discount_minor bigint not null,
  tax_rate_bp int null,
  total_minor bigint not null,
  -- [{ "title": "...", "percentBp": 4000, "amountMinor": 400000 }]
  milestones json not null,
  sections json not null,
  timeline json not null,
  clauses json not null,
  ready_at datetime(3) null,
  signed_on date null,
  signed_by_name varchar(120) not null default '',
  cancel_reason varchar(300) null,
  created_by char(36) null,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3),
  constraint client_contracts_proposal_fk foreign key (proposal_id) references proposals (id),
  constraint client_contracts_deal_fk foreign key (deal_id) references deals (id),
  constraint client_contracts_client_fk foreign key (client_id) references clients (id),
  constraint client_contracts_template_fk foreign key (template_id) references client_contract_templates (id) on delete set null,
  constraint client_contracts_created_by_fk foreign key (created_by) references users (id) on delete set null,
  constraint client_contracts_status_ok check (status in ('draft', 'ready', 'signed', 'cancelled')),
  constraint client_contracts_name_len check (char_length(client_name) between 2 and 160),
  constraint client_contracts_currency_ok check (currency in ('EGP', 'USD', 'SAR', 'AED', 'EUR')),
  constraint client_contracts_total_ok check (total_minor > 0 and discount_minor >= 0),
  constraint client_contracts_tax_ok check (tax_rate_bp is null or tax_rate_bp between 0 and 10000),
  constraint client_contracts_json_ok check (json_valid(items) and json_valid(milestones) and json_valid(sections) and json_valid(timeline) and json_valid(clauses)),
  constraint client_contracts_signed_ok check ((status = 'signed') = (signed_on is not null)),
  constraint client_contracts_cancel_ok check ((status = 'cancelled') = (cancel_reason is not null)),
  index client_contracts_proposal_idx (proposal_id),
  index client_contracts_deal_idx (deal_id),
  index client_contracts_created_idx (created_at)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table invoice_counters (
  year int not null primary key,
  last_number int not null
) default charset utf8mb4 collate utf8mb4_unicode_ci;

create table invoices (
  id char(36) not null primary key default (uuid()),
  number varchar(20) not null unique,
  contract_id char(36) not null,
  -- Which payment of the contract's schedule this money is for, if any (0-based position).
  milestone_index int null,
  amount_minor bigint not null,
  currency char(3) not null,
  paid_on date not null,
  method varchar(20) not null,
  reference varchar(120) not null default '',
  note varchar(500) not null default '',
  status varchar(10) not null default 'issued',
  void_reason varchar(300) null,
  voided_at datetime(3) null,
  voided_by char(36) null,
  created_by char(36) null,
  created_at datetime(3) not null default current_timestamp(3),
  constraint invoices_contract_fk foreign key (contract_id) references client_contracts (id),
  constraint invoices_voided_by_fk foreign key (voided_by) references users (id) on delete set null,
  constraint invoices_created_by_fk foreign key (created_by) references users (id) on delete set null,
  constraint invoices_amount_ok check (amount_minor > 0),
  constraint invoices_milestone_ok check (milestone_index is null or milestone_index >= 0),
  constraint invoices_method_ok check (method in ('bank_transfer', 'instapay', 'wallet', 'cash', 'card', 'other')),
  constraint invoices_status_ok check (status in ('issued', 'void')),
  constraint invoices_void_ok check (((status = 'void') = (void_reason is not null)) and ((status = 'void') = (voided_at is not null))),
  index invoices_contract_idx (contract_id),
  index invoices_paid_idx (paid_on)
) default charset utf8mb4 collate utf8mb4_unicode_ci;

-- The first template: the usual headings of a software project contract, in neutral wording. Every [...] is a gap
-- the owner fills (a contract can't be marked ready while one is left). It should be reviewed by a lawyer.
insert into client_contract_templates (id, title, clauses) values (
  uuid(),
  'عقد تنفيذ مشروع برمجي',
  json_array(
    json_object('title', 'موضوع العقد',
      'body', 'يتولى الطرف الأول ({اسم_الشركة}) تنفيذ «{عنوان_المشروع}» لصالح الطرف الثاني ({اسم_العميل}) وفق نطاق العمل الوارد في الملحق (1) والمأخوذ من العرض الفني والمالي رقم {رقم_العرض}، ويُعد الملحقان جزءًا لا يتجزأ من هذا العقد.'),
    json_object('title', 'التزامات الطرف الأول',
      'body', concat_ws('\n',
        '- تنفيذ الأعمال الواردة في نطاق العمل وفق الجدول الزمني الوارد في الملحق (1).',
        '- إطلاع الطرف الثاني على سير العمل: [وسيلة التحديثات ومعدّلها].',
        '- [التزامات أخرى]')),
    json_object('title', 'التزامات الطرف الثاني',
      'body', concat_ws('\n',
        '- تقديم المحتوى والمواد والصلاحيات اللازمة للتنفيذ في المواعيد المتفق عليها.',
        '- مراجعة المخرجات والرد عليها خلال [عدد الأيام] من تسليمها.',
        '- سداد المستحقات وفق جدول الدفعات الوارد في الملحق (2).')),
    json_object('title', 'المقابل المادي وطريقة السداد',
      'body', 'إجمالي قيمة هذا العقد {إجمالي_العقد}، تُسدَّد وفق جدول الدفعات الوارد في الملحق (2) عن طريق [طريقة السداد وبيانات الحساب].'),
    json_object('title', 'مدة التنفيذ والتسليم',
      'body', 'يبدأ التنفيذ في {تاريخ_البدء}، ومدته التقديرية {مدة_التنفيذ}. [شروط تمديد المدة وطريقة التسليم والاستلام]'),
    json_object('title', 'المراجعات والتعديلات',
      'body', concat_ws('\n',
        '- يشمل المقابل [عدد الجولات] جولات مراجعة لكل مرحلة.',
        '- أي طلب خارج نطاق العمل المتفق عليه يُسعَّر ويُجدول منفصلًا بعد الاتفاق عليه كتابيًا.')),
    json_object('title', 'الملكية الفكرية',
      'body', '[متى وكيف تنتقل ملكية الكود المصدري والتصميمات إلى الطرف الثاني، وما يحتفظ به الطرف الأول]'),
    json_object('title', 'السرية',
      'body', 'يلتزم كل طرف بالحفاظ على سرية المعلومات التي يطّلع عليها بسبب هذا العقد، وعدم إفشائها للغير إلا بموافقة كتابية من الطرف الآخر، طوال مدة العقد ولمدة [المدة] بعد انتهائه.'),
    json_object('title', 'الضمان والدعم',
      'body', '[مدة الدعم الفني بعد التسليم، وما يشمله وما لا يشمله]'),
    json_object('title', 'الفسخ',
      'body', '[شروط فسخ العقد من أي طرف، ومدة الإخطار، وتسوية المستحقات عن الأعمال المنفذة حتى تاريخ الفسخ]'),
    json_object('title', 'القانون الواجب التطبيق والنزاعات',
      'body', 'يخضع هذا العقد لأحكام [القانون الواجب التطبيق]، ويسعى الطرفان لحل أي خلاف وديًا، فإن تعذّر يُحال إلى [الجهة المختصة].'),
    json_object('title', 'نسخ العقد',
      'body', 'حُرر هذا العقد من نسختين، بيد كل طرف نسخة للعمل بموجبها.')
  )
);
