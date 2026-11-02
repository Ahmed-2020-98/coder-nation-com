// =====================================================================
// Arabic copy for the whole site. ALL visible text lives in this file.
//
// This is the text the site SHIPS with. The sections listed in src/lib/content-spec.ts can be edited from the admin
// panel (/admin/content); what is saved there is laid over this file when the page renders (src/lib/content-model.ts),
// and "reset to default" returns to exactly what is below. Everything not in that list is read from here only.
//
// Status: TEMPORARY placeholder copy — replace it from the admin panel (or edit freely here).
// Adding English later: create `en.ts` with the same shape (type it as `SiteContent`)
// and register it in ./index.ts. Components never hard-code text.
// =====================================================================

/** Syntax-highlight classes for the hero code window. */
export type CodeKind = "kw" | "str" | "fn" | "id" | "punc" | "cmt";
export type CodeToken = readonly [CodeKind, string];

/** One project of "أعمالنا": its card on the home page and its own page at /work/<slug>. */
export type WorkItem = {
  art: "browser" | "phone" | "dashboard";
  category: string;
  title: string;
  /** The page's address (/work/<slug>). Empty = made from the title. */
  slug: string;
  text: string;
  client: string;
  year: string;
  duration: string;
  challenge: string;
  solution: string;
  results: string[];
  tags: string[];
  link: string;
  image: string;
  gallery: { image: string; caption: string }[];
  sample: boolean;
};

// Placeholder case-study text for the sample projects: neutral wording, no numbers and no claims.
const SAMPLE_CHALLENGE = "نص مؤقت: هنا نصف المشكلة التي أراد العميل حلّها، ومن هم المستخدمون، وما الذي كان يعيق النمو قبل المشروع.";
const SAMPLE_SOLUTION = [
  "نص مؤقت: هنا نصف ما أنجزناه خطوة بخطوة.",
  "- تحليل الاحتياج وتحديد نطاق العمل.",
  "- تصميم الواجهات واعتمادها مع العميل.",
  "- البرمجة والاختبار ثم الإطلاق.",
].join("\n");
const SAMPLE_RESULTS = ["نتيجة مؤقتة: أثر المشروع على العميل", "نتيجة مؤقتة: ما الذي تغيّر بعد الإطلاق"];

export const ar = {
  meta: {
    lang: "ar",
    dir: "rtl" as "rtl" | "ltr",
    siteName: "Coder Nation",
    title: "Coder Nation | تصميم وبرمجة المواقع وتطبيقات الموبايل",
    description:
      "نصمّم ونبرمج مواقع إلكترونية وتطبيقات موبايل ومتاجر إلكترونية بتصميم مخصص وأداء عالٍ، من الفكرة حتى الإطلاق والصيانة.",
  },

  a11y: {
    skip: "تخطَّ إلى المحتوى الرئيسي",
    home: "Coder Nation — الصفحة الرئيسية",
    mainNav: "التنقل الرئيسي",
    openMenu: "فتح القائمة",
    closeMenu: "إغلاق القائمة",
    newTab: "(يفتح في نافذة جديدة)",
  },

  brand: {
    // Temporary text logo, rendered as: <icon> Coder + Nation
    first: "Coder",
    second: "Nation",
  },

  nav: {
    links: [
      { label: "الخدمات", href: "#services" },
      { label: "لماذا نحن", href: "#why" },
      { label: "طريقة العمل", href: "#process" },
      { label: "أعمالنا", href: "#work" },
      { label: "الأسئلة الشائعة", href: "#faq" },
    ],
    cta: { label: "اطلب مشروعك", href: "#contact" },
  },

  hero: {
    badge: "نستقبل مشاريع جديدة",
    titleLead: "نصمّم ونبرمج مواقع وتطبيقات",
    titleHighlight: "تنمّي أعمالك",
    description:
      "في Coder Nation نحوّل فكرتك إلى منتج رقمي سريع وآمن وسهل الاستخدام، بدءًا من التصميم وحتى الإطلاق والصيانة.",
    primaryCta: { label: "اطلب مشروعك", href: "#contact" },
    secondaryCta: { label: "شاهد أعمالنا", href: "#work" },
    stackLabel: "نعمل بأحدث التقنيات",
    stack: ["Next.js", "Flutter", "TypeScript", "Figma"],
    visual: {
      fileName: "coder-nation.tsx",
      buildCommand: "npm run build",
      buildResult: "Compiled in 1.4s",
      phoneAppName: "Your App",
      // Decorative code typed out in the hero window (not translated).
      codeLines: [
        [["kw", "import"], ["punc", " { "], ["id", "idea"], ["punc", " } "], ["kw", "from"], ["str", ' "@you"'], ["punc", ";"]],
        [],
        [["kw", "const"], ["id", " project"], ["punc", " = "], ["kw", "await"], ["fn", " build"], ["punc", "({"]],
        [["punc", "  "], ["id", "type"], ["punc", ": "], ["str", '"website + mobile app"'], ["punc", ","]],
        [["punc", "  "], ["id", "design"], ["punc", ": "], ["str", '"custom"'], ["punc", ","]],
        [["punc", "  "], ["id", "stack"], ["punc", ": ["], ["str", '"Next.js"'], ["punc", ", "], ["str", '"Flutter"'], ["punc", "],"]],
        [["punc", "  "], ["id", "support"], ["punc", ": "], ["kw", "true"], ["punc", ","]],
        [["punc", "});"]],
        [],
        [["id", "project"], ["punc", "."], ["fn", "launch"], ["punc", "();"], ["cmt", "  // ✓ live"]],
      ] as CodeToken[][],
    },
  },

  services: {
    index: "01",
    eyebrow: "الخدمات",
    title: "حلول رقمية متكاملة تحت سقف واحد",
    description:
      "من الفكرة الأولى حتى الإطلاق، نغطي كل ما يحتاجه مشروعك الرقمي ليبدو احترافيًا ويعمل بكفاءة.",
    cardCta: "ابدأ مشروعك",
    items: [
      {
        icon: "code",
        file: "websites.tsx",
        title: "تصميم وبرمجة المواقع",
        description:
          "مواقع تعريفية ومنصات للشركات، سريعة ومتجاوبة مع كل الشاشات ومهيأة لمحركات البحث، ومبنية بأحدث التقنيات.",
        features: ["تصميم متجاوب بالكامل", "أداء عالٍ وسرعة تحميل", "جاهزة لمحركات البحث"],
      },
      {
        icon: "smartphone",
        file: "mobile_app.dart",
        title: "تطبيقات الموبايل (Flutter)",
        description:
          "تطبيقات iOS وAndroid بكود واحد باستخدام Flutter، بتجربة سلسة وأداء قريب من التطبيقات الأصلية.",
        features: ["iOS وAndroid من كود واحد", "واجهات سلسة وسريعة", "النشر على المتاجر"],
      },
      {
        icon: "cart",
        file: "store.tsx",
        title: "المتاجر الإلكترونية",
        description:
          "متاجر متكاملة تدير المنتجات والطلبات والمدفوعات بسهولة، وتمنح عملاءك تجربة شراء مريحة.",
        features: ["لوحة تحكم سهلة", "ربط بوابات الدفع", "إدارة المخزون والطلبات"],
      },
      {
        icon: "pen",
        file: "design.fig",
        title: "تصميم UI/UX",
        description:
          "واجهات وتجارب استخدام مدروسة، تبدأ بفهم المستخدم وتنتهي بنموذج تفاعلي جاهز للتنفيذ.",
        features: ["تحليل المستخدم والمنافسين", "نماذج أولية تفاعلية", "نظام تصميم متكامل"],
      },
    ],
  },

  why: {
    index: "02",
    eyebrow: "لماذا نحن",
    title: "لماذا تختار Coder Nation؟",
    description: "لا نبيعك قالبًا جاهزًا؛ نبني معك منتجًا يخدم أهدافك ويكبر معك.",
    diffTitle: "templates..custom",
    srRemove: "بدلًا من:",
    srAdd: "معنا:",
    diff: [
      { type: "remove", text: "قوالب جاهزة تتشابه مع غيرها" },
      { type: "add", text: "تصميم مخصص يعبّر عن هويتك" },
      { type: "remove", text: "كود مزدحم يصعب تطويره" },
      { type: "add", text: "كود نظيف وقابل للتوسّع" },
      { type: "remove", text: "تسليم ثم اختفاء" },
      { type: "add", text: "دعم وصيانة بعد الإطلاق" },
      { type: "remove", text: "مواعيد مفتوحة بلا التزام" },
      { type: "add", text: "جدول زمني واضح والتزام بالتسليم" },
    ] as { type: "add" | "remove"; text: string }[],
    reasons: [
      { icon: "palette", title: "تصميم مخصص بالكامل", text: "هوية بصرية تعبّر عنك، لا قوالب مكررة." },
      { icon: "code", title: "كود نظيف وقابل للتوسّع", text: "بنية منظمة تسهّل التطوير والصيانة لاحقًا." },
      { icon: "gauge", title: "أداء وسرعة", text: "صفحات خفيفة وتجربة سلسة على كل الأجهزة." },
      { icon: "calendar", title: "التزام بالمواعيد", text: "جدول زمني واضح ومتابعة منتظمة حتى التسليم." },
      { icon: "chat", title: "شفافية في التواصل", text: "تحديثات دورية وقناة مباشرة معك طوال المشروع." },
      { icon: "support", title: "دعم وصيانة مستمرة", text: "نبقى بجانبك بعد الإطلاق لضمان الاستقرار والتطوير." },
    ],
  },

  process: {
    index: "03",
    eyebrow: "طريقة العمل",
    title: "من الفكرة إلى الإطلاق، خطوة بخطوة",
    description: "مراحل واضحة نراجعها معك في كل خطوة، حتى لا تتفاجأ بأي شيء عند التسليم.",
    deliverableLabel: "المخرج",
    steps: [
      {
        hash: "a1f3c9e",
        title: "التواصل وفهم الفكرة",
        text: "نستمع إليك ونفهم هدفك وجمهورك وميزانيتك، ونحدد نطاق المشروع بوضوح.",
        deliverable: "ملخص المشروع",
      },
      {
        hash: "7b20d4a",
        title: "التحليل والتخطيط",
        text: "نحوّل المتطلبات إلى خطة عمل وجدول زمني وهيكل واضح للصفحات والمزايا.",
        deliverable: "خطة وجدول زمني",
      },
      {
        hash: "c94e1f8",
        title: "التصميم",
        text: "نصمّم الواجهات ونماذج تفاعلية لتراجعها معنا قبل أي برمجة.",
        deliverable: "تصميم UI/UX معتمد",
      },
      {
        hash: "3d5a7b2",
        title: "التطوير",
        text: "نبني المشروع على مراحل قصيرة مع عرض دوري للنتائج ليبقى كل شيء تحت نظرك.",
        deliverable: "نسخة تجريبية تعمل",
      },
      {
        hash: "e08c6d1",
        title: "الاختبار والتسليم",
        text: "نختبر الأداء والأمان وتوافق الأجهزة، ثم نطلق المشروع وندرّب فريقك على استخدامه.",
        deliverable: "مشروع جاهز للإطلاق",
      },
      {
        hash: "5f19a3c",
        title: "الدعم والصيانة",
        text: "نتابع الأداء ونصلح الأعطال ونطوّر المزايا بعد الإطلاق وفق احتياجك.",
        deliverable: "خطة دعم وصيانة",
      },
    ],
  },

  work: {
    index: "04",
    eyebrow: "أعمالنا",
    title: "مشاريع نفخر بها",
    description: "نماذج من أنواع المشاريع التي نبنيها. المحتوى الحالي مؤقت وسيُستبدل بأعمالنا الفعلية.",
    placeholderBadge: "نموذج مؤقت",
    visitLabel: "زيارة المشروع",
    caseLabel: "تفاصيل المشروع",
    allLabel: "كل الأعمال",
    items: [
      {
        art: "browser",
        category: "موقع شركة",
        title: "مشروع تجريبي ١",
        slug: "sample-company-site",
        text: "وصف مختصر للمشروع وما أنجزناه فيه (نص مؤقت).",
        client: "",
        year: "",
        duration: "",
        challenge: SAMPLE_CHALLENGE,
        solution: SAMPLE_SOLUTION,
        results: [...SAMPLE_RESULTS],
        tags: ["Next.js", "Tailwind"],
        link: "",
        image: "",
        gallery: [],
        sample: true,
      },
      {
        art: "phone",
        category: "تطبيق موبايل",
        title: "مشروع تجريبي ٢",
        slug: "sample-mobile-app",
        text: "وصف مختصر للمشروع وما أنجزناه فيه (نص مؤقت).",
        client: "",
        year: "",
        duration: "",
        challenge: SAMPLE_CHALLENGE,
        solution: SAMPLE_SOLUTION,
        results: [...SAMPLE_RESULTS],
        tags: ["Flutter", "Firebase"],
        link: "",
        image: "",
        gallery: [],
        sample: true,
      },
      {
        art: "dashboard",
        category: "لوحة تحكم",
        title: "مشروع تجريبي ٣",
        slug: "sample-dashboard",
        text: "وصف مختصر للمشروع وما أنجزناه فيه (نص مؤقت).",
        client: "",
        year: "",
        duration: "",
        challenge: SAMPLE_CHALLENGE,
        solution: SAMPLE_SOLUTION,
        results: [...SAMPLE_RESULTS],
        tags: ["React", "Charts"],
        link: "",
        image: "",
        gallery: [],
        sample: true,
      },
      {
        art: "browser",
        category: "متجر إلكتروني",
        title: "مشروع تجريبي ٤",
        slug: "sample-online-store",
        text: "وصف مختصر للمشروع وما أنجزناه فيه (نص مؤقت).",
        client: "",
        year: "",
        duration: "",
        challenge: SAMPLE_CHALLENGE,
        solution: SAMPLE_SOLUTION,
        results: [...SAMPLE_RESULTS],
        tags: ["Next.js", "Payments"],
        link: "",
        image: "",
        gallery: [],
        sample: true,
      },
      {
        art: "phone",
        category: "تصميم UI/UX",
        title: "مشروع تجريبي ٥",
        slug: "sample-ux-design",
        text: "وصف مختصر للمشروع وما أنجزناه فيه (نص مؤقت).",
        client: "",
        year: "",
        duration: "",
        challenge: SAMPLE_CHALLENGE,
        solution: SAMPLE_SOLUTION,
        results: [...SAMPLE_RESULTS],
        tags: ["Figma", "Prototype"],
        link: "",
        image: "",
        gallery: [],
        sample: true,
      },
      {
        art: "dashboard",
        category: "منصة خدمات",
        title: "مشروع تجريبي ٦",
        slug: "sample-services-platform",
        text: "وصف مختصر للمشروع وما أنجزناه فيه (نص مؤقت).",
        client: "",
        year: "",
        duration: "",
        challenge: SAMPLE_CHALLENGE,
        solution: SAMPLE_SOLUTION,
        results: [...SAMPLE_RESULTS],
        tags: ["TypeScript", "API"],
        link: "",
        image: "",
        gallery: [],
        sample: true,
      },
    ] as WorkItem[],
  },

  // Shown for any address on the public site that does not exist (and for a project that was removed).
  notFound: {
    title: "الصفحة غير موجودة",
    text: "ربما تغيّر رابط الصفحة أو حُذفت. يمكنك العودة للصفحة الرئيسية أو تصفّح أعمالنا.",
    home: "الصفحة الرئيسية",
    work: "أعمالنا",
  },

  // The /work pages (one per project). Fixed interface text, not edited from the admin panel.
  workPage: {
    breadcrumb: "مسار الصفحة",
    home: "الرئيسية",
    caseStudy: "case study",
    spec: "ملف المشروع",
    specFile: "project.json",
    client: "العميل",
    year: "السنة",
    duration: "مدة التنفيذ",
    category: "النوع",
    stack: "التقنيات",
    challenge: "التحدي",
    solution: "الحل",
    results: "أبرز النتائج",
    gallery: "من داخل المشروع",
    prev: "المشروع السابق",
    next: "المشروع التالي",
    others: "مشاريع أخرى",
    ctaTitle: "عندك فكرة مشروع؟",
    ctaText: "حدّثنا عنها، وسنعود إليك بخطة واضحة وعرض مناسب لميزانيتك.",
    ctaButton: "اطلب مشروعك",
    ctaHref: "/#contact",
    // How many projects: 1 / 2 / 3-10 / 11+ take different forms in Arabic.
    count: { one: "مشروع واحد", two: "مشروعان", few: "{n} مشاريع", many: "{n} مشروعًا" },
  },

  testimonials: {
    index: "05",
    eyebrow: "آراء العملاء",
    title: "ماذا يقول عملاؤنا",
    description: "آراء مؤقتة، ستُستبدل بآراء عملائنا الحقيقيين.",
    items: [
      { quote: "نص مؤقت لرأي العميل، يصف تجربة التعامل مع الفريق وجودة التصميم والتسليم في الموعد.", name: "اسم العميل", role: "المنصب — اسم الشركة" },
      { quote: "نص مؤقت لرأي العميل، يصف وضوح التواصل أثناء المشروع وسرعة الاستجابة للملاحظات.", name: "اسم العميل", role: "المنصب — اسم الشركة" },
      { quote: "نص مؤقت لرأي العميل، يصف جودة الكود والدعم الذي حصل عليه بعد إطلاق المشروع.", name: "اسم العميل", role: "المنصب — اسم الشركة" },
    ],
  },

  faq: {
    index: "06",
    eyebrow: "الأسئلة الشائعة",
    title: "إجابات سريعة عن أكثر الأسئلة تكرارًا",
    description: "إن لم تجد ما تبحث عنه، فراسلنا وسنرد عليك بأسرع وقت.",
    helpTitle: "لم تجد إجابة سؤالك؟",
    helpText: "فريقنا جاهز للإجابة عن أي استفسار يخص مشروعك.",
    helpCta: { label: "تواصل معنا", href: "#contact" },
    items: [
      {
        q: "كم تستغرق مدة تنفيذ المشروع؟",
        a: "تختلف المدة بحسب حجم المشروع وتعقيده. نحدد جدولًا زمنيًا واضحًا بعد فهم المتطلبات، ونلتزم به مع تحديثات دورية.",
      },
      {
        q: "هل تقدمون خدمات الدعم والصيانة بعد التسليم؟",
        a: "نعم، نقدّم خطط دعم وصيانة تشمل إصلاح الأعطال والتحديثات الأمنية وتطوير مزايا جديدة وفق احتياجك.",
      },
      {
        q: "ما التقنيات التي تستخدمونها؟",
        a: "نستخدم Next.js وTypeScript للمواقع والمتاجر، وFlutter لتطبيقات الموبايل، ونختار الأنسب لطبيعة مشروعك.",
      },
      {
        q: "هل يمكنني متابعة سير العمل أثناء التنفيذ؟",
        a: "بالتأكيد. نشارك معك نسخًا تجريبية وتحديثات دورية لتراجع كل مرحلة وتعتمدها قبل الانتقال إلى ما بعدها.",
      },
      {
        q: "كيف يتم تحديد السعر؟",
        a: "يعتمد السعر على نطاق المشروع ومزاياه. بعد جلسة التعارف نرسل لك عرضًا مفصلًا بالمراحل والتكلفة.",
      },
      {
        q: "هل أحتاج إلى تجهيز المحتوى قبل البدء؟",
        a: "ليس بالضرورة. نساعدك في تنظيم المحتوى وتحديد ما تحتاجه، ثم تزوّدنا به أثناء مرحلة التصميم.",
      },
    ],
  },

  contact: {
    index: "07",
    eyebrow: "تواصل معنا",
    title: "لنبدأ مشروعك معًا",
    description: "أخبرنا بفكرتك وسنعود إليك بخطة واضحة وعرض مناسب.",
    codeComment: "جاهزون لسماع فكرتك",
    whatsapp: {
      label: "تواصل عبر واتساب",
      message: "مرحبًا Coder Nation، أرغب في الاستفسار عن مشروع.",
    },
    info: [
      { icon: "mail", label: "البريد الإلكتروني", value: "hello@coder-nation.com" },
      { icon: "clock", label: "ساعات العمل", value: "الأحد – الخميس، ٩ صباحًا – ٦ مساءً" },
    ],
    form: {
      title: "أرسل لنا تفاصيل مشروعك",
      requiredMark: "مطلوب",
      optionalMark: "اختياري",
      submit: "أرسل الطلب",
      fields: {
        name: { label: "الاسم الكامل", placeholder: "اكتب اسمك" },
        phone: { label: "رقم الهاتف / واتساب", placeholder: "+20 100 000 0000" },
        email: { label: "البريد الإلكتروني", placeholder: "name@company.com" },
        service: {
          label: "نوع المشروع",
          placeholder: "اختر نوع المشروع",
          options: ["موقع إلكتروني", "تطبيق موبايل", "متجر إلكتروني", "تصميم UI/UX", "أخرى"],
        },
        message: { label: "تفاصيل المشروع", placeholder: "صف فكرتك وأهدافك بإيجاز" },
      },
      errors: {
        summaryTitle: "يرجى تصحيح الحقول التالية",
        name: "الرجاء إدخال الاسم (حرفان على الأقل)",
        phone: "الرجاء إدخال رقم هاتف صحيح",
        email: "الرجاء إدخال بريد إلكتروني صحيح",
        service: "اختر نوع المشروع من القائمة",
        message: "التفاصيل أطول من اللازم (الحد 2000 حرف)",
      },
      // Shown when the request could not be saved or the visitor sent too many; always paired with the WhatsApp link.
      failure: {
        server: "تعذّر إرسال طلبك الآن. حاول مرة أخرى بعد قليل، أو تواصل معنا مباشرة عبر واتساب.",
        tooMany: "أرسلت عددًا كبيرًا من الطلبات. حاول مرة أخرى بعد قليل، أو تواصل معنا عبر واتساب.",
        sending: "جارٍ الإرسال…",
      },
      success: {
        title: "تم استلام طلبك",
        text: "شكرًا لك. سنراجع تفاصيل مشروعك ونتواصل معك قريبًا.",
        again: "إرسال طلب آخر",
      },
    },
  },

  footer: {
    description: "نصمّم ونبرمج مواقع وتطبيقات موبايل ومتاجر إلكترونية، من الفكرة حتى الإطلاق والصيانة.",
    columns: [
      {
        title: "الخدمات",
        links: [
          { label: "تصميم وبرمجة المواقع", href: "#services" },
          { label: "تطبيقات الموبايل", href: "#services" },
          { label: "المتاجر الإلكترونية", href: "#services" },
          { label: "تصميم UI/UX", href: "#services" },
        ],
      },
      {
        title: "الشركة",
        links: [
          { label: "لماذا نحن", href: "#why" },
          { label: "طريقة العمل", href: "#process" },
          { label: "أعمالنا", href: "#work" },
          { label: "الأسئلة الشائعة", href: "#faq" },
        ],
      },
    ],
    contactTitle: "تواصل",
    socialTitle: "تابعنا",
    // Shown in the footer only for the accounts filled in from the admin panel's settings.
    socialLabels: { linkedin: "LinkedIn", x: "X", instagram: "Instagram", github: "GitHub", tiktok: "TikTok", youtube: "YouTube" } as Record<string, string>,
    ecosystemTitle: "منظومتنا",
    ecosystemLabels: { marketing: "التسويق", sales: "المبيعات", crm: "إدارة العملاء" } as Record<string, string>,
    rights: "جميع الحقوق محفوظة.",
    backToTop: "العودة إلى الأعلى",
  },
};
