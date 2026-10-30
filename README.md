# Coder Nation

أربعة أجزاء في repo واحد. الموقع منفصل عن منظومة الـ Agents، والـ Dashboard بيشغّل الـ Agents، والـ Ops هو النظام الداخلي للفريق (CRM وعروض PDF ومهام ومشاريع وحضور وانصراف).

| المجلد | إيه هو | التشغيل |
|---|---|---|
| [`1-coder-nation`](1-coder-nation) | الموقع التعريفي + لوحة تحكم `/admin` لطلبات العملاء وإعدادات الموقع (Next.js 16 + Tailwind v4 + Postgres، عربي RTL، محتوى مؤقت) | `npm install` ثم الإعداد في [README بتاعه](1-coder-nation/README.md) ثم `npm run dev` على `http://localhost:3000` |
| [`2-marketing-agent`](2-marketing-agent) | Marketing Agent لمحتوى TikTok: Orchestrator (`CLAUDE.md`) + 4 Sub-Agents في `.claude/agents/` (Research / Script / Montage / Posting) + ملفات الأسلوب `marketing/style/` | افتح `claude` جوه المجلد (أول مرة اقبل الـ workspace trust) |
| [`4-ops`](4-ops) | النظام الداخلي لفريق Coder Nation: حسابات وأدوار (مالك / مدير / موظف) + CRM + عروض فنية ومالية بـ PDF + توزيع المهام والمشاريع + الحضور والانصراف. الطلبات من فورم الموقع بتوصله تلقائيًا (Next.js 16 + Postgres) | الإعداد في [README بتاعه](4-ops/README.md) ثم `npm run dev` على `http://localhost:3020` |
| [`3-marketing-dashboard`](3-marketing-dashboard) | Dashboard عربي لتشغيل الـ Agents ومتابعة كل فيديو في Pipeline (Next.js 16 + Claude Agent SDK) | `npm install && npm run dev` على `http://127.0.0.1:3010`، والتفاصيل في [README بتاعه](3-marketing-dashboard/README.md) |

## ملاحظات

- الـ Dashboard **Local فقط**: مفيش تسجيل دخول، وبيكتب ملفات ويشغّل Agents من حسابك. متنشرهوش على دومين من غير Auth.
- من غير `ANTHROPIC_API_KEY`، الـ Dashboard بيستخدم دخول claude.ai اللي `claude` عنده على جهازك. ده لاستخدامك الشخصي بس (شوف التحفظ في README الـ Dashboard). للفريق أو للنشر استخدم مفتاح API.
- مفيش نشر فعلي على TikTok: الـ Posting Agent معاه مفيش أدوات نشر، والنشر يدوي.
- الـ Agents لسه "مسودة قبل التدريب" لحد ما `marketing/style/*.md` تتدرّب.
- مفيش أسرار في الـ repo: ملفات `.env*` متجاهَلة ما عدا `.env.example`.
