// What the admin panel may edit in the page text, field by field. ONE description drives three things: the editor form
// (src/components/admin/content), the validation of what is saved (src/lib/content-model.ts) and the defaults it is
// compared with. Safe to import from browser code: no database, no secrets.
//
// Anything not listed here (the hero's decorative code window, the contact form's labels and error messages, the
// accessibility strings, the logo) stays in src/content/ar.ts, because other code depends on the exact wording.

export const SECTION_IDS = ["hero", "nav", "services", "why", "process", "work", "testimonials", "faq", "contact", "footer"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const isSectionId = (value: unknown): value is SectionId => typeof value === "string" && (SECTION_IDS as readonly string[]).includes(value);

/** Page sections that carry a "// 01" number, in page order. Hidden ones are skipped, so the numbers never have gaps. */
export const NUMBERED_SECTIONS = ["services", "why", "process", "work", "testimonials", "faq", "contact"] as const satisfies readonly SectionId[];

/** The sections the admin may switch off (the hero, the menu, the contact form and the footer always stay). */
export const HIDEABLE_SECTIONS = ["services", "why", "process", "work", "testimonials", "faq"] as const satisfies readonly SectionId[];

/** The `id` of each section's element on the page: what "#work" in a menu link points to. */
export const SECTION_ANCHOR: Record<SectionId, string> = {
  hero: "top",
  nav: "top",
  services: "services",
  why: "why",
  process: "process",
  work: "work",
  testimonials: "testimonials",
  faq: "faq",
  contact: "contact",
  footer: "top",
};

type Common = { label: string; hint?: string };

export type FieldSpec =
  | ({ kind: "text"; max: number; min?: number; ltr?: boolean; optional?: boolean } & Common)
  | ({ kind: "area"; max: number; min?: number; rows?: number; optional?: boolean } & Common)
  | ({ kind: "href"; optional?: boolean; httpsOnly?: boolean } & Common)
  | ({ kind: "select"; options: readonly { value: string; label: string }[] } & Common)
  | ({ kind: "bool" } & Common)
  | ({ kind: "image" } & Common)
  /** Kept as stored and never shown (e.g. the fake commit hash of a process step); `blank()` creates it for new items. */
  | { kind: "hidden"; pattern: RegExp }
  | ({ kind: "strings"; itemLabel: string; min: number; max: number; itemMax: number; ltr?: boolean } & Common)
  | ({ kind: "group"; fields: Record<string, FieldSpec> } & Common)
  | ({
      kind: "list";
      itemLabel: string;
      /** The item field shown as its title while the item is collapsed. */
      titleKey: string;
      min: number;
      max: number;
      fields: Record<string, FieldSpec>;
      blank: () => Record<string, unknown>;
    } & Common);

export type SectionSpec = {
  id: SectionId;
  title: string;
  description: string;
  /** Where "preview" jumps to on the public page. */
  anchor: string;
  note?: { text: string; href: string; linkLabel: string };
  fields: Record<string, FieldSpec>;
};

export const ICON_OPTIONS = [
  { value: "code", label: "كود" },
  { value: "smartphone", label: "موبايل" },
  { value: "cart", label: "سلة / متجر" },
  { value: "pen", label: "قلم / تصميم" },
  { value: "palette", label: "ألوان" },
  { value: "gauge", label: "سرعة وأداء" },
  { value: "calendar", label: "تقويم / مواعيد" },
  { value: "chat", label: "محادثة" },
  { value: "support", label: "دعم" },
] as const;

const ART_OPTIONS = [
  { value: "browser", label: "متصفح (موقع)" },
  { value: "phone", label: "موبايل (تطبيق)" },
  { value: "dashboard", label: "لوحة تحكم" },
] as const;

export const IMAGE_ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const text = (label: string, max: number, extra: { min?: number; hint?: string; ltr?: boolean; optional?: boolean } = {}): FieldSpec => ({ kind: "text", label, max, ...extra });
const area = (label: string, max: number, extra: { min?: number; hint?: string; rows?: number; optional?: boolean } = {}): FieldSpec => ({ kind: "area", label, max, ...extra });
const href = (label: string, extra: { hint?: string; optional?: boolean; httpsOnly?: boolean } = {}): FieldSpec => ({ kind: "href", label, ...extra });
const link = (label: string): FieldSpec => ({ kind: "group", label, fields: { label: text("النص", 40), href: href("الرابط", { hint: "#contact للنزول لقسم، أو https://… لموقع، أو tel:/mailto:" }) } });

const randomHash = () => Array.from({ length: 7 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

/** The header every numbered section has. */
const header = (): Record<string, FieldSpec> => ({
  eyebrow: text("العنوان الصغير", 30, { hint: "الكلمة اللي فوق العنوان الكبير، مثلًا: الخدمات" }),
  title: text("العنوان", 120, { min: 3 }),
  description: area("الوصف", 300, { optional: true, rows: 2 }),
});

export const SECTION_SPECS: Record<SectionId, SectionSpec> = {
  hero: {
    id: "hero",
    title: "الواجهة الرئيسية",
    description: "أول حاجة بيشوفها الزائر: العنوان الكبير والوصف والأزرار.",
    anchor: "top",
    fields: {
      badge: text("الشارة الصغيرة", 60, { hint: "مثلًا: نستقبل مشاريع جديدة" }),
      titleLead: text("بداية العنوان", 80, { min: 3 }),
      titleHighlight: text("الجزء الملوّن من العنوان", 40, { min: 2 }),
      description: area("الوصف", 300, { min: 10, rows: 3 }),
      primaryCta: link("الزرار الأساسي"),
      secondaryCta: link("الزرار الثانوي"),
      stackLabel: text("عنوان قائمة التقنيات", 60),
      stack: { kind: "strings", label: "التقنيات", itemLabel: "تقنية", min: 0, max: 8, itemMax: 24, ltr: true },
    },
  },

  nav: {
    id: "nav",
    title: "القائمة العلوية",
    description: "روابط القائمة وزرار «اطلب مشروعك» فوق.",
    anchor: "top",
    fields: {
      links: {
        kind: "list",
        label: "روابط القائمة",
        itemLabel: "رابط",
        titleKey: "label",
        min: 1,
        max: 8,
        fields: { label: text("النص", 30), href: href("الرابط", { hint: "مثلًا #services للنزول لقسم الخدمات" }) },
        blank: () => ({ label: "رابط جديد", href: "#contact" }),
      },
      cta: link("الزرار"),
    },
  },

  services: {
    id: "services",
    title: "الخدمات",
    description: "الخدمات اللي بتقدّمها، كل خدمة في كارت.",
    anchor: "services",
    fields: {
      ...header(),
      cardCta: text("نص رابط الكارت", 40),
      items: {
        kind: "list",
        label: "الخدمات",
        itemLabel: "خدمة",
        titleKey: "title",
        min: 1,
        max: 8,
        fields: {
          icon: { kind: "select", label: "الأيقونة", options: ICON_OPTIONS },
          file: text("اسم الملف الصغير", 40, { ltr: true, hint: "تفصيلة شكلية بتظهر في ركن الكارت، مثلًا websites.tsx" }),
          title: text("اسم الخدمة", 80, { min: 2 }),
          description: area("الوصف", 300, { min: 10, rows: 3 }),
          features: { kind: "strings", label: "المزايا", itemLabel: "ميزة", min: 0, max: 6, itemMax: 80 },
        },
        blank: () => ({ icon: "code", file: "service.tsx", title: "خدمة جديدة", description: "وصف مختصر للخدمة وما تقدّمه.", features: [] }),
      },
    },
  },

  why: {
    id: "why",
    title: "لماذا نحن",
    description: "مقارنة «بدلًا من / معنا» وأسباب اختيارك.",
    anchor: "why",
    fields: {
      ...header(),
      diffTitle: text("عنوان المقارنة", 40, { ltr: true, hint: "اسم الملف في أعلى صندوق المقارنة" }),
      diff: {
        kind: "list",
        label: "المقارنة («بدلًا من» و«معنا»)",
        itemLabel: "سطر",
        titleKey: "text",
        min: 0,
        max: 12,
        fields: {
          type: {
            kind: "select",
            label: "النوع",
            options: [
              { value: "remove", label: "بدلًا من (مشطوب بالأحمر)" },
              { value: "add", label: "معنا (بالأخضر)" },
            ],
          },
          text: text("النص", 100, { min: 2 }),
        },
        blank: () => ({ type: "add", text: "ميزة جديدة" }),
      },
      reasons: {
        kind: "list",
        label: "الأسباب",
        itemLabel: "سبب",
        titleKey: "title",
        min: 0,
        max: 9,
        fields: {
          icon: { kind: "select", label: "الأيقونة", options: ICON_OPTIONS },
          title: text("العنوان", 60, { min: 2 }),
          text: area("الوصف", 200, { min: 5, rows: 2 }),
        },
        blank: () => ({ icon: "code", title: "سبب جديد", text: "وصف مختصر للسبب." }),
      },
    },
  },

  process: {
    id: "process",
    title: "طريقة العمل",
    description: "مراحل التنفيذ من أول التواصل لحد الدعم.",
    anchor: "process",
    fields: {
      ...header(),
      deliverableLabel: text("كلمة «المخرج»", 30),
      steps: {
        kind: "list",
        label: "المراحل",
        itemLabel: "مرحلة",
        titleKey: "title",
        min: 1,
        max: 10,
        fields: {
          hash: { kind: "hidden", pattern: /^[0-9a-f]{7}$/ },
          title: text("اسم المرحلة", 60, { min: 2 }),
          text: area("الوصف", 250, { min: 10, rows: 2 }),
          deliverable: text("المخرج", 60, { min: 2 }),
        },
        blank: () => ({ hash: randomHash(), title: "مرحلة جديدة", text: "وصف مختصر للمرحلة.", deliverable: "مخرج المرحلة" }),
      },
    },
  },

  work: {
    id: "work",
    title: "أعمالنا",
    description: "مشاريعك اللي بتفتخر بيها. ارفع صورة لكل مشروع، ولو مفيش بيظهر رسم تجريبي.",
    anchor: "work",
    fields: {
      ...header(),
      placeholderBadge: text("نص شارة «نموذج»", 30, { hint: "بتظهر على أي مشروع علّمته «نموذج مؤقت»" }),
      visitLabel: text("نص رابط المشروع", 30, { hint: "بيظهر لو المشروع ليه رابط، مثلًا: زيارة المشروع" }),
      items: {
        kind: "list",
        label: "المشاريع",
        itemLabel: "مشروع",
        titleKey: "title",
        min: 0,
        max: 12,
        fields: {
          title: text("اسم المشروع", 80, { min: 2 }),
          category: text("النوع", 40, { min: 2, hint: "مثلًا: متجر إلكتروني" }),
          text: area("الوصف", 250, { min: 5, rows: 2 }),
          tags: { kind: "strings", label: "التقنيات", itemLabel: "تقنية", min: 0, max: 6, itemMax: 24, ltr: true },
          image: { kind: "image", label: "صورة المشروع", hint: "JPG أو PNG أو WebP، حتى 2 ميجا. بتتصغّر تلقائيًا قبل الرفع." },
          art: { kind: "select", label: "الرسم التجريبي (لو مفيش صورة)", options: ART_OPTIONS },
          link: href("رابط المشروع (اختياري)", { optional: true, httpsOnly: true, hint: "لازم يبدأ بـ https://" }),
          sample: { kind: "bool", label: "نموذج مؤقت (تظهر عليه شارة)", hint: "شيّلها لما تحط مشروع حقيقي" },
        },
        blank: () => ({ title: "مشروع جديد", category: "نوع المشروع", text: "وصف مختصر للمشروع وما أنجزناه فيه.", tags: [], image: "", art: "browser", link: "", sample: false }),
      },
    },
  },

  testimonials: {
    id: "testimonials",
    title: "آراء العملاء",
    description: "كلام عملائك عنك. لو مسحت كل الآراء القسم كله بيختفي من الموقع.",
    anchor: "testimonials",
    fields: {
      ...header(),
      items: {
        kind: "list",
        label: "الآراء",
        itemLabel: "رأي",
        titleKey: "name",
        min: 0,
        max: 12,
        fields: {
          quote: area("نص الرأي", 400, { min: 10, rows: 3 }),
          name: text("اسم العميل", 60, { min: 2 }),
          role: text("المنصب والشركة", 80, { min: 2 }),
        },
        blank: () => ({ quote: "رأي العميل في التعامل مع الفريق وجودة العمل.", name: "اسم العميل", role: "المنصب — الشركة" }),
      },
    },
  },

  faq: {
    id: "faq",
    title: "الأسئلة الشائعة",
    description: "أسئلة عملائك المتكررة وإجاباتها.",
    anchor: "faq",
    fields: {
      ...header(),
      helpTitle: text("عنوان صندوق المساعدة", 60),
      helpText: text("نص صندوق المساعدة", 160),
      helpCta: link("زرار صندوق المساعدة"),
      items: {
        kind: "list",
        label: "الأسئلة",
        itemLabel: "سؤال",
        titleKey: "q",
        min: 0,
        max: 20,
        fields: { q: text("السؤال", 150, { min: 3 }), a: area("الإجابة", 800, { min: 3, rows: 3 }) },
        blank: () => ({ q: "سؤال جديد؟", a: "إجابة السؤال." }),
      },
    },
  },

  contact: {
    id: "contact",
    title: "التواصل",
    description: "عنوان قسم التواصل وزرار واتساب.",
    anchor: "contact",
    note: { text: "رقم الواتساب والإيميل وساعات العمل بتتعدّل من صفحة الإعدادات.", href: "/admin/settings", linkLabel: "فتح الإعدادات" },
    fields: {
      ...header(),
      codeComment: text("التعليق الصغير", 80, { hint: "السطر الشكلي اللي بيبدأ بـ //" }),
      whatsapp: {
        kind: "group",
        label: "زرار واتساب",
        fields: {
          label: text("نص الزرار", 40),
          message: text("الرسالة الجاهزة", 200, { min: 3, hint: "بتتكتب لوحدها لما الزائر يفتح واتساب" }),
        },
      },
    },
  },

  footer: {
    id: "footer",
    title: "الفوتر",
    description: "الوصف وأعمدة الروابط في آخر الصفحة.",
    anchor: "top",
    fields: {
      description: area("الوصف", 240, { min: 10, rows: 3 }),
      columns: {
        kind: "list",
        label: "أعمدة الروابط",
        itemLabel: "عمود",
        titleKey: "title",
        min: 0,
        max: 3,
        fields: {
          title: text("عنوان العمود", 30, { min: 2 }),
          links: {
            kind: "list",
            label: "الروابط",
            itemLabel: "رابط",
            titleKey: "label",
            min: 0,
            max: 8,
            fields: { label: text("النص", 40), href: href("الرابط") },
            blank: () => ({ label: "رابط جديد", href: "#contact" }),
          },
        },
        blank: () => ({ title: "عمود جديد", links: [] }),
      },
      contactTitle: text("عنوان عمود التواصل", 30),
      socialTitle: text("عنوان عمود السوشيال", 30),
      ecosystemTitle: text("عنوان عمود المنظومة", 30),
      rights: text("جملة الحقوق", 60),
      backToTop: text("نص «العودة للأعلى»", 40),
    },
  },
};

/** Links the visitor may follow: a section on this page, a path on this site, https, mailto: or tel:. Never javascript:. */
export function isSafeHref(value: string, httpsOnly = false): boolean {
  if (value.length === 0 || value.length > 200 || /[\s<>"'`\\]/.test(value)) return false;
  if (!httpsOnly) {
    if (/^#[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(value)) return true;
    if (/^\/(?!\/)[A-Za-z0-9\-._~!$&()*+,;=:@%/?#]*$/.test(value)) return true;
    if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return true;
    if (/^tel:\+?[0-9]{5,15}$/.test(value)) return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
  } catch {
    return false;
  }
}
