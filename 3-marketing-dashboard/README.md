# Marketing Dashboard — Coder Nation

واجهة عربية (RTL) لتشغيل الـ Marketing Agent ومتابعة كل فيديو من الفكرة للنشر. الـ Dashboard **بتستخدم** الـ Agents الموجودة في `../2-marketing-agent/` (Research / Script / Montage / Posting) ومبتعيدش بناءهم: كل تشغيل بيحمّل `.claude/agents/*.md` الحقيقية عن طريق **Claude Agent SDK**.

> Local فقط حاليًا (`127.0.0.1`). مفيش Auth، فمتنشرهاش على `marketing.codernation.com` قبل ما تضيف تسجيل دخول (الـ routes بتكتب ملفات وبتصرف من مفتاحك).

## التشغيل

```bash
cd 3-marketing-dashboard
npm install
npm run dev                     # http://127.0.0.1:3010
```

للتشغيل الدائم: `npm run build && npm start` (نفس البورت). مفيش ملف `.env.local` مطلوب للتشغيل العادي (الإعدادات الاختيارية في `.env.example`).

### تسجيل الدخول: من غير API key (الافتراضي)

الـ Agents بتشتغل عن طريق **Claude Agent SDK**، وهو بيشغّل Claude Code محلي على جهازك. لو مفيش `ANTHROPIC_API_KEY`، بيستخدم **دخول claude.ai اللي `claude` عنده أصلًا** (اشتراك Pro/Max).

```bash
claude auth status     # لازم يقول loggedIn: true. لو لأ: شغّل `claude` واعمل /login
```

- سطر "دخول Claude" في الشريط الجانبي بيعرض الحالة (مثلًا "اشتراك Claude Pro"). لو مش مسجّل دخول، بانر أحمر بيقولك تعمل إيه، وأي زرار تشغيل بيرجّع 503 برسالة واضحة من غير ما يبدأ run.
- التشغيل **بيخصم من حدود استخدام اشتراكك** مش من رصيد API. لو الحد خلص هتظهر رسالة "حد استخدام اشتراكك خلص" وتستنى لحد ما يتجدد. عشان كده افتراضي التشغيلات المتزامنة = 1.
- "الاستهلاك التقديري" في الواجهة هو تقدير الـ SDK لحجم التشغيل، **مش فلوس بتتدفع** على اشتراك.
- الـ run بيبدأ كجلسة مستقلة: الـ Dashboard بيشيل متغيّرات الجلسة الأم (`CLAUDECODE` وغيرها) من بيئة الـ SDK، فمفيش مشكلة لو السيرفر اتشغّل من جوه جلسة Claude Code.

> **تحفظ مهم:** صفحة الـ Agent SDK الرسمية بتقول إن Anthropic مش بتسمح لمطوّرين تانيين يقدّموا دخول claude.ai في منتجاتهم، ومبتتكلمش صراحةً عن أداة شخصية على جهاز صاحب الاشتراك. الاستخدام ده مقصود لـ **حسابك أنت بس، على جهازك**. متشاركش الدخول مع الفريق ومتنشرش الأداة (مثلًا على `marketing.codernation.com`) بالطريقة دي: وقتها استخدم API key (أو Bedrock/Vertex).

### أو: API key

لو عايز تدفع بالتوكن (للفريق أو للنشر)، افتح `.env.local` وحط:

```
ANTHROPIC_API_KEY=sk-ant-...
```

- المفتاح بيتقري في السيرفر بس. مفيش `NEXT_PUBLIC_` في المشروع، ومبيتحطش في أي رد API أو Log. و`/api/health` بيرجّع نوع الدخول والخطة بس، مش أي مفتاح.
- لما المفتاح موجود، هو اللي بيتستخدم (`CLAUDE_AUTH=auto`). لو عايز الاشتراك بالذات وعندك مفتاح متصدّر في الـ shell، حط `CLAUDE_AUTH=subscription` وهيتخبّى عن الـ Agents.
- `.env.local` متتجاهل في git. أعد تشغيل السيرفر بعد أي تعديل فيه.

### جرّب الواجهة من غير مفتاح ومن غير تكلفة

```bash
npm run demo            # يشغّل على نسخة معزولة في data/demo بـ Agents مُحاكاة
npm run demo -- --reset # يمسح بيانات الـ demo ويبدأ من جديد
```

الـ demo بيكتب ملفات بنفس قوالب الـ Agents، فالمشوار كله (Research ← Script ← Montage ← Posting) بيشتغل، لكنه **لا يقول حاجة عن جودة الـ Agents الحقيقية**. ومبيلمسش `../2-marketing-agent`.

## الإعدادات (`.env.local`)

| المتغير | الافتراضي | معناه |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | اختياري. من غيره بيتستخدم دخول claude.ai (فوق) |
| `CLAUDE_AUTH` | `auto` | `auto` (المفتاح لو موجود وإلا الاشتراك) \| `subscription` \| `api_key` |
| `AGENT_ROOT` | `../2-marketing-agent` | مشروع الـ Agents (`CLAUDE.md`, `.claude/agents`, `marketing/`) |
| `CLAUDE_MODEL` | `sonnet` | الموديل لكل التشغيلات |
| `RUN_EFFORT` | (افتراض الموديل) | `low`…`max`: مجهود التفكير لكل تشغيل. أعلى = تفكير واستهلاك أكتر |
| `RUN_BUDGET_USD` | `2` | سقف لكل تشغيل. مع المفتاح فلوس فعلية، ومع الاشتراك تقدير الـ SDK بس (تخمين، عدّله بعد أول تجارب) |
| `MAX_UPLOAD_MB` | `2048` | حد حجم الفيديو |
| `MAX_CONCURRENT_RUNS` | `1` مع الاشتراك، `2` مع المفتاح | عدد التشغيلات الشغالة في نفس الوقت |
| `DATA_DIR` | `data` | مكان SQLite والفيديوهات المرفوعة |
| `FAKE_AGENT_RUNS` | — | `1` = محاكاة (dev فقط، متتفعّلش في production) |

## الصفحات

1. **لوحة المتابعة** — Kanban: فكرة ← سكريبت ← تصوير/مونتاج ← جاهز للنشر ← منشور. الكارت بيتحرك **بأزرار الاعتماد فقط** (مفيش سحب)، وفيه "إرجاع للمرحلة السابقة".
2. **Research** — لصق كومنتات أو رفع CSV/XLSX/TXT، Tags للكلمات المفتاحية، الترندات، "حلّل"، جدول clusters + Bar chart، "حوّل لفكرة".
3. **السكريبت** — Hook / المحتوى / CTA، المدة live، "تعديل بالـ AI" (نسخ `-v2`, `-v3` بدون مسح)، "اعتمد"، "احفظ كمثال لأسلوبي".
4. **التصوير والمونتاج** — Shot list، Teleprompter، رفع الفيديو، خطة مونتاج بـ Timestamps وفريمات حقيقية.
5. **النشر** — كابشن/هاشتاجات/وقت قابلين للتعديل، تقويم، "جاهز للنشر". **مفيش نشر فعلي ولا كود نشر.** زرار "نشرته" يدوي بينقل الكارت لعمود "منشور".
6. **التدريب** — عرض/تعديل `script-style.md` و`montage-style.md`، تاريخ كامل، diff، استرجاع، وتبديل `trained` بتأكيد صريح.

## هيكل الملفات

```
.env.example            كل الإعدادات (انسخه لـ .env.local)
scripts/                demo.mjs · smoke-agents.mjs · palette.mjs
tests/                  parsers / server / flow (Vitest) + smoke/ (تشغيل حقيقي، بيتكلف فلوس)
src/proxy.ts            يرفض أي Host مش localhost/127.0.0.1
src/styles/tokens.css   Design tokens (Orange / Navy) — نفس الموقع
src/app/(app)/          الصفحات الست
src/app/teleprompter/   وضع الـ Teleprompter (ملء الشاشة)
src/app/api/            الـ routes
src/components/         ui · shell · kanban · research · script · filming · posting · training · runs
src/server/             (server-only)
  agents/               sdk.ts (التشغيل الحقيقي) · permissions.ts · prompts.ts · fake.ts (المحاكاة)
  files/ parse/         قراءة/كتابة ملفات الـ markdown وتحليل مخرجات الـ Agents
  services/             منطق كل مرحلة وبواباتها
  db.ts jobs.ts         SQLite (node:sqlite) + تشغيل الـ runs في الخلفية مع SSE
```

الـ **محتوى** (الأفكار، السكريبتات، خطط المونتاج، البوستات، الـ style) بيفضل ملفات markdown داخل `AGENT_ROOT/marketing/` بنفس اتفاقيات الـ Agents، فتفضل متوافقة مع الـ terminal. SQLite للحالة بس: الكروت والمراحل والـ runs والجدولة وتاريخ الـ style.

## الصلاحيات والأمان

- كل Agent ليه قواعد صلاحيات صريحة (`permissionMode: "dontAsk"`: أي أداة مش مسموحة = مرفوضة). مثلًا الـ posting-agent مفيش معاه Bash ولا ويب، والـ montage-agent معاه `ffmpeg`/`ffprobe` فقط.
- ولا Agent يقدر يكتب في `marketing/style/` أو `marketing/inputs/` أو `.claude/` أو `CLAUDE.md`. الـ Dashboard هو اللي يكتب ملفاتك.
- Host guard على كل الطلبات، وفحص Origin على الكتابة، وتحقق zod، وحماية المسارات، وأسماء فيديو عشوائية (اسم المستخدم مبيدخلش أي Prompt أو shell).

## الاختبارات

```bash
npm test                            # 90 اختبار حتمي (parsers على مخرجات حقيقية، flow كامل بالمحاكاة، الصلاحيات، الدخول، الـ guard): مجاني
npm run typecheck && npm run lint
npm run smoke:agents -- --wiring    # مجاني، من غير نداء موديل: يتأكد إن الـ 4 Agents بيتحملوا + نوع الدخول (اشتراك/مفتاح)
npm run smoke:agents                # تشغيل حقيقي للـ 4 Agents على نسخة مؤقتة. بيستهلك من الاشتراك أو بيتكلف فلوس مع المفتاح
```

الـ `smoke:agents` بيسيب النسخة المؤقتة (كل اللي كتبته الـ Agents) ويطبع مكانها، **اقرا ملفاتها**: الاختبار بيثبت القوالب والمجاميع وإن مفيش حاجة من `style/` أو `inputs/` اتعدّلت، مش إن الجودة كويسة. امسحها لما تخلص (`rm -rf` بالمسار اللي بيطبعه).

## اللي اتقاس في تشغيل حقيقي (2026-10-29، دخول اشتراك Claude Pro، موديل sonnet)

مشوار كامل على 12 كومنت تجريبي، **التكلفة التقديرية للمشوار كله ≈ $0.47**:

| المرحلة | التقدير |
|---|---|
| Research (بحث ويب + عدّ) | $0.17 |
| Script | $0.09 |
| Shot list | $0.03 |
| Montage (ffprobe + فريمات حقيقية) | $0.12 |
| Posting | $0.07 |

مخرجات حقيقية من كل مرحلة في `data/smoke-sample/` (مش في git)، وأمثلة منها بتثبّت الـ parsers في `tests/fixtures/real-*.md`.

اتعلّمنا منها حاجات ما كانتش ظاهرة من القوالب (واتصلّحت): الـ Agent بيحط صف "المجموع" في جدول الـ clusters، وبيكتب أكتر من كومنت في سطر السؤال، وبيضيف "— N كلمات" في آخر سطر الـ Hook، وبيحط بلوك "بدائل متعادلة" غير مرقّم. ولما بيتمنع من أمر بيحاول بطريقة تانية، وساعات بيستسلم (ظهر في تشغيل حقيقي)؛ عشان كده الـ Dashboard بقى بيعرض في خطوات التشغيل **كل أمر اتمنع** وحجم الاستهلاك (tokens والتفكير)، وبيعرض رد الـ Agent الأخير لو خلّص من غير ملف.

### حاجتين اتقاسوا وغيّروا التصميم

1. **connectors حساب claude.ai**: مع دخول الاشتراك، الـ SDK كان بيحمّل connectors حسابك (Gmail/Notion/Adobe/Shopify/Vercel…). تشغيل صغير جدًا (shot list بيقرا ملفين) كتب ~187 ألف token في الكاش وكلّف **$0.77–$1.03 تقديري بدل $0.03**، وكان للـ Agent وصول نظري لأدوات خدماتك. دلوقتي كل الـ runs بتتقفل عنها بأربع طبقات: `ENABLE_CLAUDEAI_MCP_SERVERS=false` و`strictMcpConfig` و`mcpServers: {}` وقاعدة منع `mcp__*`.
2. **حد استخدام Pro حقيقي**: أثناء الاختبار الحد خلص مرة، فلازم تتوقع ده لو شغّلت كتير. الرسالة اللي هتظهرلك: "حد استخدام اشتراكك خلص دلوقتي".

## أول تشغيل حقيقي من عندك

1. `claude auth status` (لازم `loggedIn: true`)، وبعدين `npm run smoke:agents -- --wiring`.
2. `npm run dev` وجرّب Research بكومنتات حقيقية، وراقب "الاستهلاك" في خطوات الـ RunPanel.
3. لو عايز تخفّض التفكير والاستهلاك: `RUN_EFFORT=low|medium|high|xhigh|max` في `.env.local` (الافتراضي هو افتراض الموديل، وما غيّرتوش لأني ما قستش تأثيره على جودة العربي).
4. `.claude/settings.json` جوه `2-marketing-agent` فيه قواعد `ffmpeg` بتحتاج Trust للمجلد لما تشغّل Claude Code من الـ terminal. الـ Dashboard مش محتاجها (قواعده صريحة في `permissions.ts`).

## حدود معروفة

- الـ Agents لسه "مسودة قبل التدريب": لغة الـ Hook فصحى مبسطة لأن `script-style.md` فاضي. الجودة الحقيقية بتبدأ بعد التدريب.
- الـ montage-agent معاه `ffmpeg *`، وقواعد الـ Bash مطابقة نصية: مفيش حاجة بتمنع ffmpeg تكتب خارج مجلد الفريمات لو الـ Agent قرر كده. الاحتياط الوحيد هو الـ prompt والـ Agent نفسه، فاستخدمه على فيديوهاتك أنت بس.
- الـ parsers مبنية على قوالب الـ Agents ومثبّتة على مخرجات حقيقية قليلة. لو غيّرت قالب في `.claude/agents/*.md` أو ظهر شكل جديد، حدّث `src/server/parse/*` وضيف الملف في `tests/fixtures/`.
- تشغيلات الـ montage على فيديو حقيقي لسه ما اتجرّبتش (الاختبار على فيديو مولَّد بـ ffmpeg).
- الـ Shot list بتتولّد من prompt تابع للـ Dashboard (مش من Agent)، وبتتعلّم "مسودة" لحد ما تدرّب `montage-style.md`.
- التشغيل محتاج سيرفر Node دائم (الـ SDK بيشغّل process محلي)، فمش مناسب لـ Vercel Serverless.
- مفيش Auth ولا نشر فعلي على TikTok (خارج النطاق حاليًا).
