# Coder Nation: الموقع التعريفي + لوحة التحكم

Next.js 16 (App Router) + TypeScript + Tailwind v4، عربي RTL. الموقع العام (محتوى مؤقت) + لوحة تحكم `/admin` لطلبات العملاء وإعدادات الموقع، على MySQL (أو MariaDB).

## التشغيل

```bash
npm install
mysql -uroot -e 'create database coder_nation_site character set utf8mb4 collate utf8mb4_unicode_ci'   # مرة واحدة (MySQL محلي)
cp .env.example .env.local          # وعدّل DATABASE_URL و IP_HASH_SALT
npm run db:migrate                  # يعمل الجداول
npm run admin:create -- --email you@example.com   # يعمل أول أدمن (بيسألك على الباسورد مخفي)
npm run dev                         # http://localhost:3000  ·  اللوحة: http://localhost:3000/admin
```

الأوامر الباقية: `npm run build` · `npm start` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run palette`.

الموقع العام **بيشتغل من غير قاعدة بيانات** (بيعرض القيم الافتراضية من الكود)، لكن الفورم والـ `/admin` محتاجينها. الـ build مبيعتمدش عليها.

## لوحة التحكم (`/admin`)

| الصفحة | بتعمل إيه |
|---|---|
| `/admin/login` | دخول بإيميل وباسورد. 5 محاولات فاشلة / 15 دقيقة لكل (IP + إيميل) وبعدها قفل مؤقت. |
| `/admin` | عدّادات الطلبات وآخر الطلبات، وتحذير لو رقم الواتساب لسه المؤقت. |
| `/admin/leads` | طلبات العملاء من فورم الموقع: فلتر بالحالة، بحث (اسم/هاتف/إيميل)، ترقيم صفحات، وتصدير CSV (بيتعقّم ضد الـ formulas وبـ BOM عشان Excel يقرا العربي). |
| `/admin/leads/[id]` | التفاصيل، أزرار واتساب / اتصال / إيميل، الحالة (جديد / تم التواصل / مغلق)، ملاحظة داخلية، وحذف. |
| `/admin/content` | **محتوى الموقع**: كل أقسام الصفحة الرئيسية (الواجهة، القائمة، الخدمات، لماذا نحن، طريقة العمل، أعمالنا، آراء العملاء، الأسئلة الشائعة، التواصل، الفوتر) مع حالة كل قسم (معدّل / النص الافتراضي / مخفي) وعدد عناصره. |
| `/admin/content/[section]` | محرّر القسم: تعديل كل النصوص، وإضافة وحذف وترتيب العناصر (مشاريع، آراء، أسئلة، خدمات…)، ورفع صور المشاريع، وإخفاء القسم من الموقع، و«رجّع للافتراضي». **الحفظ بيظهر على الموقع فورًا.** |
| `/admin/settings` | رقم الواتساب، الإيميل، ساعات العمل، السوشيال، عنوان ووصف الـ SEO، وروابط المنظومة. **التغيير بيظهر على الموقع فورًا.** |

- مفيش أدمن افتراضي. بتعمله بـ `npm run admin:create` (و`--reset` لتغيير الباسورد وتسجيل الخروج من كل الأجهزة). الباسورد 12 حرف على الأقل.
- **محتوى الصفحة** بيتعدّل من `/admin/content` (مش لازم تلمس الكود). اللي ما بيتعدّلش من اللوحة (لأن كود تاني معتمد على صياغته): شكل نافذة الكود في الـ Hero، وعناوين فورم التواصل ورسائل أخطائه، ونصوص إمكانية الوصول، واللوجو. دول في `src/content/ar.ts`.
- النص المخزّن في القاعدة بيتحط **فوق** النص اللي في `ar.ts` (`computeView` في `src/lib/content-model.ts`). لو القاعدة مش شغالة أو القسم مفيهوش تعديل، الموقع بيعرض نص الكود، فمفيش صفحة بتقع بسببه.
- قسم فاضي (مسحت كل الآراء مثلًا) أو متخفّي بيختفي من الموقع، وبتتشال معاه روابطه من القائمة والفوتر والأزرار، وأرقام الأقسام («// 01») بتتظبط من غير فجوات.
- **صور المشاريع** بتتخزّن في القاعدة (جدول `media`) مش على الديسك، لأن الاستضافة بتمسح الملفات المرفوعة في كل Deploy. بتتصغّر في المتصفح قبل الرفع (حتى 1600px)، والسيرفر بيتأكد من نوع الملف من أول بايتاته (JPG / PNG / WebP بس، حتى 2 ميجا، ومفيش SVG)، وبتتقدّم من `/media/<id>` بكاش دائم. الصورة اللي اتشالت أو اتبدّلت بتتمسح من القاعدة بعد ساعة.

## فورم التواصل

الفورم بيتحقق في المتصفح للسرعة وبعدين `submitLead` (Server Action) بيتحقق تاني ويحفظ في `leads`. حماية: honeypot، و5 طلبات/ساعة لكل زائر، والـ IP بيتخزّن مجرد hash مفتاحي (مش العنوان نفسه). لو الحفظ فشل الزائر بيشوف رسالة واضحة ورابط واتساب بديل.

## الأمان

- كل صفحة وAction وroute في `/admin` بتنادي `requireAdmin()` بنفسها. `src/proxy.ts` بيعمل redirect سريع لو مفيش كوكي، لكنه **مش** الحماية الفعلية.
- الباسورد scrypt بملح لكل مستخدم، والجلسات في الـ DB (بيتخزّن hash التوكن بس)، والكوكي `HttpOnly` + `SameSite=Strict` (+`Secure` في production) على `/admin` بس. مدة الجلسة 7 أيام.
- كل استعلامات الـ SQL parameterized، والبحث substring عادي (الـ `%` و`_` حروف مش wildcards).
- `/admin` ليه headers صارمة: `no-store` و`frame-ancestors 'none'` و`no-referrer` و`noindex`.
- `IP_HASH_SALT` **إجباري في production** (`openssl rand -hex 24`).
- خلف proxy غير Vercel لازم يبعت `X-Forwarded-For` صح، لأن منه بيتحسب الـ rate limit.

## هيكل الملفات

```
db/migrations/        SQL migrations (001_init.sql، 002_media.sql) · migrate.mjs
scripts/              migrate.mjs · create-admin.mjs · palette.mjs
src/
├─ app/
│  ├─ (site)/           الموقع العام: layout.tsx (root) · page.tsx · actions.ts (submitLead)
│  ├─ (admin)/          لوحة التحكم: layout.tsx (root تاني) · admin/{login,(panel)/{leads,settings,content/...}} · actions.ts
│  ├─ media/[id]/       route.ts: بيقدّم الصور المرفوعة من القاعدة
│  ├─ fonts.ts · globals.css · icon.svg · robots.ts · sitemap.ts
├─ proxy.ts             redirect تفاؤلي لـ /admin
├─ server/              db · password · auth-core · session · rate-limit · leads · settings · content · media · request · env
├─ styles/tokens.css    كل الـ Design Tokens
├─ content/             ar.ts (كل النصوص) · index.ts
├─ config/              site.ts (قيم افتراضية) · ecosystem.ts
├─ components/          ui · sections · admin (AdminShell, ui/*) · Logo · Reveal · OrganizationJsonLd
└─ lib/                 cn · lead-rules · lead-contact · csv · settings-shape · session-cookie · content-spec · content-model · content-form · image-upload
tests/                  unit + integration (قواعد MySQL مؤقتة بتتعمل وتتمسح)
```

## أين أعدّل؟

| المطلوب | المكان |
|---|---|
| رقم الواتساب والإيميل وساعات العمل والسوشيال والـ SEO وروابط المنظومة | `/admin/settings` |
| نصوص الأقسام وأعمالنا وآراء العملاء والأسئلة والخدمات | `/admin/content` |
| النصوص اللي مش في اللوحة (فورم التواصل، نافذة الكود…) | `src/content/ar.ts` |
| الألوان النهائية | `npm run palette -- --primary "#XXXXXX" --secondary "#YYYYYY"` |
| لغة إنجليزية لاحقًا | `src/content/en.ts` بنفس شكل `ar.ts` وسجّله في `src/content/index.ts` |
| الخطوط | `src/app/fonts.ts` |
| اللوجو المؤقت | `src/components/Logo.tsx` |

## للنشر لاحقًا (مش معمول دلوقتي)

1. قاعدة MySQL (على Hostinger: من hPanel أو API، والتطبيق بيتصل بـ `127.0.0.1:3306`)، و`npm run db:migrate` عليها، و`npm run admin:create` ضدها.
2. المتغيرات: `DATABASE_URL` و`SITE_URL` (الدومين الحقيقي) و`IP_HASH_SALT`.
3. **ابنِ والـ `DATABASE_URL` موجود**، عشان الصفحة المبنية تحمل إعداداتك. لو اتبنت من غيرها هتعرض القيم الافتراضية لحد أول تحديث (≤ 5 دقايق)، أو لحد ما تحفظ الإعدادات.
4. لا إشعارات للطلبات الجديدة (إيميل/واتساب) لسه: الطلبات بتظهر في اللوحة بس.

## ملاحظات

- نص الأزرار البرتقالية باللون Navy لأن الأبيض على `#FF6B1A` تباينه 2.85:1 (لا يجتاز AA)، وNavy يعطي 5.98:1.
- كل قسم يحمل `tone="navy|light"` فيقلب الألوان الدلالية تلقائيًا (`text-ink`, `bg-surface`, `text-accent`, …).
- أي عنصر جواه `data-tone` لازم يحدد لون النص بنفسه (`text-ink`)، لأن اللون بيتوارث محسوبًا من الأب مش من الـ tone الجديد.
- الأنيميشن يحترم `prefers-reduced-motion`.
- أعمالنا وآراء العملاء ورقم الواتساب الافتراضي **محتوى مؤقت** لسه. بتتبدّل من `/admin/content` و`/admin/settings` من غير كود.
