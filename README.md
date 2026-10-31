# Coder Nation

## فكرة المشروع

**Coder Nation** شركة برمجيات (Software Agency) بتبني لعملائها مواقع وأنظمة، وفي نفس الوقت بتبني **منظومة Agents بالذكاء الاصطناعي** بتشغّل الشركة نفسها: بتسوّق، وتبيع، وتتابع العملاء، وتبرمج.

الفكرة إن الشركة تشتغل بفريق بشري صغير ومعاه فريق Agents، وكل واحد فيهم متخصص:

| الـ Agent | شغلته |
|---|---|
| **Marketing** | يطلّع محتوى (بنبدأ بـ TikTok): بحث ← سكريبت ← مونتاج ← نشر، وكل مرحلة بتستنى موافقتك. |
| **Sales** | يتعامل مع الـ Lead من أول ما يوصل لحد العرض والتفاوض. |
| **CRM** | يرتّب العملاء والصفقات ويحدّث الـ Pipeline. |
| **Programming** | يبني المشاريع بعد ما الصفقة تتقفل (داخلي، من غير subdomain). |

كل Agent عبارة عن Supervisor ومعاه Sub-Agents، وبنتدرّب واحد واحد على طريقة شغل صاحب الشركة الفعلية.

### القرارات الثابتة

- **الاستقلالية حسب الخطورة:** الأفعال الداخلية (تحليل، تصنيف، تحديث CRM) بتتنفّذ أوتوماتيك. الأفعال الخارجية (رسالة لعميل، نشر، إرسال عرض، Deploy) بتعدّي على **طابور موافقات** (Approval Queue) لحد ما تتفتح الاستقلالية لكل فعل لوحده.
- **المستخدمين:** فريق Coder Nation بس (Single-tenant). بوابة العملاء مشروع منفصل لاحقًا.
- **الـ CRM هو مصدر الحقيقة** من لحظة ما Lead يتعمل. الـ Agents مبتكلمش بعض مباشرة: بتقرا وتكتب في الـ CRM بصلاحيات محددة وبأحداث (`lead.created` ← `lead.qualified` ← `deal.won` ← `project.started` ← `project.delivered`).
- **الـ Stack النهائي:** Next.js (TypeScript) على Vercel + AI SDK عن طريق AI Gateway + Workflow للـ Agents الطويلة وطابور الموافقات + MySQL (على Hostinger دلوقتي).
- **الدومينات:** `coder-nation.com` موقع تعريفي بس. الـ Agents على `marketing.` و`sales.` و`crm.` تحت نفس الدومين، بـ SSO واحد.

### رحلة العميل

```
زائر يدخل الموقع (أو يشوف فيديو TikTok)
      ↓  فورم التواصل
Lead جديد في الـ CRM            ← lead.created
      ↓  تأهيل
صفقة في الـ Pipeline (6 مراحل)   ← lead.qualified
      ↓  عرض فني ومالي PDF
فاز / خسر (الخسارة بسبب)        ← deal.won
      ↓  «ابدأ المشروع»
مشروع + مهمة لكل مرحلة في العرض  ← project.started
      ↓  الفريق ينفّذ ويتابع
تسليم                           ← project.delivered
```

## الأجزاء

أربعة أجزاء في repo واحد. الموقع منفصل عن منظومة الـ Agents، والـ Dashboard بيشغّل الـ Agents، والـ Ops هو النظام الداخلي للفريق.

| المجلد | إيه هو | التشغيل |
|---|---|---|
| [`1-coder-nation`](1-coder-nation) | الموقع التعريفي + لوحة تحكم `/admin` لطلبات العملاء وإعدادات الموقع (Next.js 16 + Tailwind v4 + MySQL، عربي RTL). النصوص الأخيرة لسه مؤقتة. | `npm install` ثم الإعداد في [README بتاعه](1-coder-nation/README.md) ثم `npm run dev` على `http://localhost:3000` |
| [`2-marketing-agent`](2-marketing-agent) | Marketing Agent لمحتوى TikTok: Orchestrator (`CLAUDE.md`) + 4 Sub-Agents في `.claude/agents/` (Research / Script / Montage / Posting) + ملفات الأسلوب `marketing/style/` | افتح `claude` جوه المجلد (أول مرة اقبل الـ workspace trust) |
| [`3-marketing-dashboard`](3-marketing-dashboard) | Dashboard عربي لتشغيل الـ Agents ومتابعة كل فيديو في Pipeline (Next.js 16 + Claude Agent SDK) | `npm install && npm run dev` على `http://127.0.0.1:3010`، والتفاصيل في [README بتاعه](3-marketing-dashboard/README.md) |
| [`4-ops`](4-ops) | النظام الداخلي للفريق: حسابات وأدوار (مالك / مدير / موظف) + CRM + عروض فنية ومالية بـ PDF + مهام ومشاريع + حضور وانصراف. طلبات الموقع بتوصله تلقائيًا بتوقيع HMAC (Next.js 16 + MySQL) | الإعداد في [README بتاعه](4-ops/README.md) ثم `npm run dev` على `http://localhost:3020` |

## الوضع الحالي

| الجزء | الحالة |
|---|---|
| الموقع + لوحة الأدمن | شغّال ومتختبر محليًا. لسه فيه محتوى مؤقت (أعمالنا، آراء العملاء، اللوجو). |
| Ops (CRM + عروض + مهام + حضور) | المراحل التلاتة خلصت ومتختبرة (101 اختبار). لسه ما اتجرّبش بفريق حقيقي. |
| Marketing Agent + Dashboard | شغّالين على TikTok، بس الأسلوب لسه **مش متدرّب** فالمخرجات «مسودة قبل التدريب». |
| Sales / CRM / Programming Agents | لسه ما بدأوش. |
| النشر (Deployment) | لسه ما حصلش. كله محلي. |

الخطوات الجاية في [`ROADMAP.md`](ROADMAP.md).

## ملاحظات

- الـ Dashboard **Local فقط**: مفيش تسجيل دخول، وبيكتب ملفات ويشغّل Agents من حسابك. متنشرهوش على دومين من غير Auth.
- من غير `ANTHROPIC_API_KEY`، الـ Dashboard بيستخدم دخول claude.ai اللي `claude` عنده على جهازك. ده لاستخدامك الشخصي بس (شوف التحفظ في README الـ Dashboard). للفريق أو للنشر استخدم مفتاح API.
- مفيش نشر فعلي على TikTok: الـ Posting Agent معاه مفيش أدوات نشر، والنشر يدوي.
- مفيش أسرار في الـ repo: ملفات `.env*` متجاهَلة ما عدا `.env.example`. الـ repo عام (Public)، فمتحطش فيه مفاتيح ولا بيانات عملاء.
