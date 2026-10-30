# Coder Nation — الموقع التعريفي (نسخة مؤقتة)

Next.js 16 (App Router) + TypeScript + Tailwind v4، عربي RTL، بدون Backend. المحتوى مؤقت.

## التشغيل

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # بناء Production
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run palette    # إعادة توليد درجات الألوان + فحص التباين
```

## هيكل الملفات

```
src/
├─ app/                 layout.tsx (الخطوط، RTL، Metadata) · page.tsx · globals.css (Base + Animations) · icon.svg
├─ styles/tokens.css    كل الـ Design Tokens (ألوان، خطوط، Radius، Shadows، Spacing، Motion)
├─ content/             ar.ts (كل النصوص) · index.ts (جاهز لإضافة en.ts)
├─ config/              site.ts (رقم واتساب) · ecosystem.ts (سب دومينات المنظومة، معطّلة حاليًا)
├─ components/
│  ├─ ui/               Button · Card · Section (+SectionHeader) · Badge
│  ├─ sections/         Navbar · Hero · Services · WhyUs · Process · Work · Testimonials · Faq · Contact · Footer
│  ├─ Reveal.tsx        ظهور عند السكرول · Logo.tsx · icons.tsx
└─ lib/cn.ts
scripts/palette.mjs     مولّد الألوان
```

## أين أعدّل؟

| المطلوب | المكان |
|---|---|
| الألوان النهائية | `npm run palette -- --primary "#XXXXXX" --secondary "#YYYYYY"` (يعيد كتابة درجات 50→900 داخل `tokens.css` ويفحص التباين) |
| أي نص في الموقع | `src/content/ar.ts` |
| لغة إنجليزية لاحقًا | أنشئ `src/content/en.ts` بنفس شكل `ar.ts` وسجّله في `src/content/index.ts` (المكوّنات تستخدم خصائص منطقية جاهزة للـ LTR) |
| رقم الواتساب | `src/config/site.ts` |
| روابط crm / sales / marketing | `src/config/ecosystem.ts` (غيّر `enabled` إلى `true` فيظهر الرابط في الـ Footer) |
| الخطوط | `src/app/layout.tsx` (Noto Kufi Arabic للعناوين · IBM Plex Sans Arabic للنص · JetBrains Mono للتفاصيل) |
| اللوجو المؤقت | `src/components/Logo.tsx` |

## ملاحظات

- نص الأزرار البرتقالية باللون Navy لأن الأبيض على `#FF6B1A` تباينه 2.85:1 (لا يجتاز AA)، وNavy يعطي 5.98:1.
- كل قسم يحمل `tone="navy|light"` فيقلب الألوان الدلالية تلقائيًا (`text-ink`, `bg-surface`, `text-accent`, …).
- فورم التواصل يتحقق من الحقول ويعرض حالة نجاح تجريبية فقط، ولا يرسل أي بيانات.
- الأنيميشن يحترم `prefers-reduced-motion`.
