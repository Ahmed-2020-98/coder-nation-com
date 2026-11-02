# الـ MCP بتاع Coder Nation Ops

بيخلّي Claude (أو أي MCP client) يقرا ويكتب في النظام: العملاء والصفقات والعروض والمشاريع والمهام والحضور والعقود والفواتير وبيانات الشركة والحسابات.

- **العنوان:** `https://ops.coder-nation.com/api/mcp` (Streamable HTTP، stateless).
- **الدخول:** بمفتاح (`Authorization: Bearer cno_…`) بيتعمل من Ops ← **مفاتيح الـ MCP**، والمالك بس هو اللي يقدر يعمله.
- **الصلاحيات:** المفتاح بيشتغل بصلاحيات صاحبه بالظبط، زي ما يكون هو اللي داخل على Ops. يعني مفتاح موظف بيشوف صفقاته ومهامه بس.

## الربط

### Claude Code
صفحة المفاتيح بتطلّعلك الأمر جاهز للنسخ:

```bash
claude mcp add --transport http coder-ops https://ops.coder-nation.com/api/mcp --header "Authorization: Bearer <المفتاح>"
```

### Claude Desktop أو أي client بيدعم HTTP
```json
{
  "mcpServers": {
    "coder-ops": {
      "url": "https://ops.coder-nation.com/api/mcp",
      "headers": { "Authorization": "Bearer <المفتاح>" }
    }
  }
}
```

## الأمان
- **المفتاح بيظهر مرة واحدة بس.** النظام بيخزّن الـ hash بتاعه بس، زي ما بيعمل مع الـ sessions.
- **إمتى المفتاح بيقف عن الشغل:**
  - لما تلغيه.
  - لما تخلص مدته (30 يوم أو 90 أو سنة).
  - لما حساب صاحبه يتوقف.
  - لما حساب صاحبه يكون لسه لازم يغيّر الباسورد.
- **أي مفتاح غلط** بيترد عليه بـ 401 من غير أي تفاصيل.
- **حد الطلبات:** 120 طلب في الدقيقة لكل مفتاح.
- **سجل العمليات:**
  - كل عملية كتابة بتتسجّل، وكل محاولة مرفوضة كمان. بتلاقيهم في صفحة المفاتيح تحت «آخر العمليات».
  - عمليات القراءة مابتتسجّلش.
- **الباسوردات عمرها ما بتعدّي على الـ MCP:**
  - `create_user` بيعمل الحساب من غير ما يرجّع باسورد.
  - الباسورد المؤقت بتاخده من Ops ← الفريق ← «باسورد جديد».
  - `reset_password` مش موجود أصلًا.
- **إزاي الكتابة بتحصل:** كل عملية كتابة بتنادي نفس الـ server action اللي الصفحة بتبعتلها. علشان كده الـ validation والصلاحيات واللي بيحصل بعدها (سجل الصفقة، ونقل المراحل، وأرقام العقود والفواتير) هي هي بالظبط زي الواجهة.
- **مش موجود في الـ MCP:**
  - الـ PDF، لأنه بيتنزّل من الواجهة.
  - موافقة الموظف على عقده، لأنها لازم تكون منه هو شخصيًا من حسابه.

## الـ tools (76)

| الموديول | Tools |
|---|---|
| عام | `whoami`، `search` |
| العملاء | `list_clients`، `get_client`، `create_client`، `update_client`، `add_contact` |
| الصفقات | `list_deals`، `get_deal`، `create_deal`، `update_deal`، `assign_deal`، `move_deal`، `add_activity`، `list_follow_ups`، `add_follow_up`، `complete_follow_up`، `pipeline_summary` |
| العروض | `list_proposals`، `get_proposal`، `create_proposal`، `save_proposal`، `mark_proposal_sent`، `set_proposal_outcome`، `duplicate_proposal` |
| المشاريع | `list_projects`، `get_project`، `create_project`، `start_project_from_deal`، `update_project` |
| المهام | `list_tasks`، `get_task`، `create_task`، `update_task`، `assign_task`، `change_task_status`، `add_task_comment` |
| الحضور | `attendance_today`، `attendance_month`، `list_leaves`، `check_in`، `check_out`، `save_shift`، `fix_attendance_record`، `delete_attendance_record`، `add_leave`، `delete_leave` |
| عقود الموظفين | `list_employee_contracts`، `get_employee_contract`، `create_employee_contract`، `save_employee_contract`، `send_employee_contract`، `withdraw_employee_contract`، `duplicate_employee_contract`، `list_contract_templates`، `save_contract_template` |
| عقود العملاء | `list_client_contracts`، `get_client_contract`، `create_client_contract`، `save_client_contract`، `mark_client_contract_ready`، `client_contract_back_to_draft`، `mark_client_contract_signed`، `cancel_client_contract`، `list_client_contract_templates`، `save_client_contract_template` |
| الفواتير | `list_invoices`، `get_invoice`، `record_payment`، `void_invoice` |
| الشركة | `get_company`، `update_company` |
| الحسابات | `list_users`، `create_user`، `set_user_role`، `set_user_active` |

**ملاحظات عن المدخلات:**
- **المبالغ** بتتكتب نص عشري بعملة العرض أو الصفقة، زي `"15000"` أو `"1500.50"`.
- **التواريخ** بالشكل `YYYY-MM-DD`، والأوقات بالشكل `HH:MM`.
- **أي حاجة بتتحفظ كاملة** (العرض، والعقد، والقالب): اقراها الأول بـ `get_*`. الرد فيه جزء اسمه `editable` بنفس الشكل اللي `save_*` بيستناه، فعدّل فيه وابعته.

## الكود
- `src/app/api/mcp/route.ts`: المفتاح، وحد الطلبات، وحجم الطلب.
- `src/server/api-tokens.ts`: المفاتيح وسجل العمليات.
- `src/server/mcp/`:
  - `context.ts` فيه `act()` اللي بتشغّل الـ server action بصلاحيات صاحب المفتاح.
  - وفيه كمان ملف لكل موديول.
- `src/server/actor.ts`: المستخدم اللي شغّال حاليًا. `getUser()` في `session.ts` بيرجّعه أثناء أي عملية MCP.
- `src/server/refresh.ts`: بديل `refresh()` بتاع Next. مابيعملش حاجة جوه عمليات الـ MCP، لأن مفيش صفحة يعملها refresh.
- الاختبارات: `tests/mcp.test.ts`.
