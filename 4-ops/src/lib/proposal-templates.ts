// Starting points for the technical part of a proposal. They are DRAFTS of neutral wording: nothing here states a
// price, a deadline, a guarantee or a claim about the company. Every `[...]` is a gap the sales person must fill
// (the editor counts them and warns before export).

export type Section = { title: string; body: string };
export type Phase = { title: string; weeks: number };
export type Template = { sections: Section[]; timeline: Phase[]; milestones: { title: string; percentBp: number }[] };

const OVERVIEW = (kind: string): Section => ({
  title: "نظرة عامة",
  body: `نقدّم في هذا العرض خطة تنفيذ ${kind} لصالح [اسم العميل]، بهدف [الهدف الرئيسي للمشروع].`,
});

const ASSUMPTIONS: Section = {
  title: "افتراضات واستثناءات",
  body: [
    "- يقدّم العميل المحتوى والمواد اللازمة في المواعيد المتفق عليها.",
    "- تشمل التكلفة عدد جولات مراجعة محددًا لكل مرحلة: [عدد الجولات].",
    "- أي طلب خارج النطاق المذكور يُسعَّر ويُجدول منفصلًا بعد الاتفاق عليه كتابيًا.",
    "- [استثناءات أخرى يحددها الفريق]",
  ].join("\n"),
};

const SUPPORT: Section = {
  title: "الدعم بعد التسليم",
  body: "[يحدد الفريق: مدة الدعم بعد التسليم، وما يشمله، وشروط التجديد]",
};

const MILESTONES = [
  { title: "دفعة مقدمة عند التعاقد", percentBp: 4000 },
  { title: "عند تسليم النسخة التجريبية", percentBp: 3000 },
  { title: "عند التسليم النهائي", percentBp: 3000 },
];

const PHASES = (build: string): Phase[] => [
  { title: "التحليل وتحديد المتطلبات والتصميم", weeks: 2 },
  { title: build, weeks: 4 },
  { title: "الاختبار والإطلاق والتسليم", weeks: 1 },
];

export const TEMPLATES: Record<string, Template> = {
  "موقع إلكتروني": {
    sections: [
      OVERVIEW("تصميم وبرمجة موقع إلكتروني"),
      { title: "نطاق العمل", body: ["- تحليل المتطلبات وهيكلة المحتوى.", "- تصميم واجهات متجاوبة مع الموبايل والتابلت والديسكتوب.", "- برمجة الصفحات: [قائمة الصفحات].", "- تهيئة الموقع لمحركات البحث (SEO) الأساسية.", "- الاختبار على المتصفحات الرئيسية ثم الإطلاق."].join("\n") },
      { title: "التقنيات المقترحة", body: "Next.js وTypeScript للواجهة، و[قاعدة البيانات / لوحة التحكم إن لزم]." },
      { title: "المخرجات", body: ["- تصميمات الواجهات المعتمدة.", "- الكود المصدري للموقع.", "- موقع منشور على [الاستضافة / الدومين]."].join("\n") },
      ASSUMPTIONS,
      SUPPORT,
    ],
    timeline: PHASES("البرمجة والتكامل"),
    milestones: MILESTONES,
  },
  "تطبيق موبايل": {
    sections: [
      OVERVIEW("تصميم وبرمجة تطبيق موبايل"),
      { title: "نطاق العمل", body: ["- تحليل المتطلبات ورسم رحلة المستخدم.", "- تصميم الواجهات والنماذج التفاعلية.", "- برمجة التطبيق لنظامي iOS وAndroid بكود واحد.", "- ربط التطبيق بالخدمات الخلفية: [الخدمات المطلوبة].", "- الاختبار ثم رفع التطبيق على المتاجر: [المتجر الأول / الاثنان]."].join("\n") },
      { title: "التقنيات المقترحة", body: "Flutter للتطبيق، و[الخدمات الخلفية وقاعدة البيانات]." },
      { title: "المخرجات", body: ["- تصميمات الواجهات المعتمدة.", "- الكود المصدري للتطبيق.", "- نسخة منشورة أو جاهزة للنشر على المتاجر."].join("\n") },
      ASSUMPTIONS,
      SUPPORT,
    ],
    timeline: PHASES("برمجة التطبيق والتكامل"),
    milestones: MILESTONES,
  },
  "متجر إلكتروني": {
    sections: [
      OVERVIEW("تصميم وبرمجة متجر إلكتروني"),
      { title: "نطاق العمل", body: ["- تصميم واجهة المتجر ورحلة الشراء.", "- إدارة المنتجات والتصنيفات والمخزون والطلبات من لوحة تحكم.", "- ربط بوابات الدفع: [بوابات الدفع المطلوبة].", "- ربط شركات الشحن: [إن وُجد].", "- الاختبار ثم الإطلاق."].join("\n") },
      { title: "التقنيات المقترحة", body: "Next.js وTypeScript، و[قاعدة البيانات وبوابات الدفع]." },
      { title: "المخرجات", body: ["- تصميمات المتجر المعتمدة.", "- الكود المصدري ولوحة التحكم.", "- متجر منشور وجاهز لاستقبال الطلبات."].join("\n") },
      ASSUMPTIONS,
      SUPPORT,
    ],
    timeline: PHASES("برمجة المتجر وربط الدفع"),
    milestones: MILESTONES,
  },
  "تصميم UI/UX": {
    sections: [
      OVERVIEW("تصميم تجربة وواجهة مستخدم"),
      { title: "نطاق العمل", body: ["- تحليل المستخدمين والمنافسين.", "- هيكلة المحتوى ورسم رحلات المستخدم.", "- نماذج أولية تفاعلية.", "- نظام تصميم (ألوان، خطوط، مكوّنات).", "- تسليم ملفات جاهزة للتنفيذ."].join("\n") },
      { title: "الأدوات", body: "[أدوات التصميم والتسليم]" },
      { title: "المخرجات", body: ["- نماذج أولية تفاعلية.", "- نظام التصميم.", "- ملفات التصميم المصدرية."].join("\n") },
      ASSUMPTIONS,
      SUPPORT,
    ],
    timeline: [
      { title: "البحث وتحليل المستخدمين", weeks: 1 },
      { title: "التصميم والنماذج الأولية", weeks: 3 },
      { title: "المراجعة والتسليم", weeks: 1 },
    ],
    milestones: [
      { title: "دفعة مقدمة عند التعاقد", percentBp: 5000 },
      { title: "عند التسليم النهائي", percentBp: 5000 },
    ],
  },
};

const GENERIC: Template = {
  sections: [OVERVIEW("المشروع"), { title: "نطاق العمل", body: "[تفاصيل نطاق العمل]" }, { title: "التقنيات المقترحة", body: "[التقنيات]" }, { title: "المخرجات", body: "[المخرجات]" }, ASSUMPTIONS, SUPPORT],
  timeline: PHASES("التنفيذ"),
  milestones: MILESTONES,
};

export function templateFor(service: string | null): Template {
  return structuredClone(TEMPLATES[service ?? ""] ?? GENERIC);
}
