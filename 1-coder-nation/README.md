# Coder Nation: الموقع التعريفي + لوحة التحكم

Next.js 16 (App Router) + TypeScript + Tailwind v4، عربي RTL. الموقع العام (محتوى مؤقت) + لوحة تحكم `/admin` لطلبات العملاء وإعدادات الموقع، على Postgres.

## التشغيل

```bash
npm install
createdb coder_nation_site          # مرة واحدة (Postgres محلي)
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
| `/admin/settings` | رقم الواتساب، الإيميل، ساعات العمل، السوشيال، عنوان ووصف الـ SEO، وروابط المنظومة. **التغيير بيظهر على الموقع فورًا.** |

- مفيش أدمن افتراضي. بتعمله بـ `npm run admin:create` (و`--reset` لتغيير الباسورد وتسجيل الخروج من كل الأجهزة). الباسورد 12 حرف على الأقل.
- تحديث نصوص الصفحة (Hero والخدمات والأسئلة…) من اللوحة **لسه مش موجود**، بتتعدّل من `src/content/ar.ts`.

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
db/migrations/        SQL migrations (001_init.sql) · migrate.mjs
scripts/              migrate.mjs · create-admin.mjs · palette.mjs
src/
├─ app/
│  ├─ (site)/           الموقع العام: layout.tsx (root) · page.tsx · actions.ts (submitLead)
│  ├─ (admin)/          لوحة التحكم: layout.tsx (root تاني) · admin/{login,(panel)/...} · actions.ts
│  ├─ fonts.ts · globals.css · icon.svg · robots.ts · sitemap.ts
├─ proxy.ts             redirect تفاؤلي لـ /admin
├─ server/              db · password · auth-core · session · rate-limit · leads · settings · request · env
├─ styles/tokens.css    كل الـ Design Tokens
├─ content/             ar.ts (كل النصوص) · index.ts
├─ config/              site.ts (قيم افتراضية) · ecosystem.ts
├─ components/          ui · sections · admin (AdminShell, ui/*) · Logo · Reveal · OrganizationJsonLd
└─ lib/                 cn · lead-rules · lead-contact · csv · settings-shape · session-cookie
tests/                  unit + integration (Postgres مؤقتة بتتعمل وتتمسح)
```

## أين أعدّل؟

| المطلوب | المكان |
|---|---|
| رقم الواتساب والإيميل وساعات العمل والسوشيال والـ SEO وروابط المنظومة | `/admin/settings` |
| أي نص في الموقع | `src/content/ar.ts` |
| الألوان النهائية | `npm run palette -- --primary "#XXXXXX" --secondary "#YYYYYY"` |
| لغة إنجليزية لاحقًا | `src/content/en.ts` بنفس شكل `ar.ts` وسجّله في `src/content/index.ts` |
| الخطوط | `src/app/fonts.ts` |
| اللوجو المؤقت | `src/components/Logo.tsx` |

## للنشر لاحقًا (مش معمول دلوقتي)

1. قاعدة Postgres مُدارة (مثلًا Neon من Vercel Marketplace)، و`npm run db:migrate` عليها، و`npm run admin:create` ضدها.
2. المتغيرات: `DATABASE_URL` و`SITE_URL` (الدومين الحقيقي) و`IP_HASH_SALT`.
3. **ابنِ والـ `DATABASE_URL` موجود**، عشان الصفحة المبنية تحمل إعداداتك. لو اتبنت من غيرها هتعرض القيم الافتراضية لحد أول تحديث (≤ 5 دقايق)، أو لحد ما تحفظ الإعدادات.
4. لا إشعارات للطلبات الجديدة (إيميل/واتساب) لسه: الطلبات بتظهر في اللوحة بس.

## ملاحظات

- نص الأزرار البرتقالية باللون Navy لأن الأبيض على `#FF6B1A` تباينه 2.85:1 (لا يجتاز AA)، وNavy يعطي 5.98:1.
- كل قسم يحمل `tone="navy|light"` فيقلب الألوان الدلالية تلقائيًا (`text-ink`, `bg-surface`, `text-accent`, …).
- أي عنصر جواه `data-tone` لازم يحدد لون النص بنفسه (`text-ink`)، لأن اللون بيتوارث محسوبًا من الأب مش من الـ tone الجديد.
- الأنيميشن يحترم `prefers-reduced-motion`.
- أعمالنا وآراء العملاء ورقم الواتساب الافتراضي **محتوى مؤقت** لسه.
