// Vocabulary of the CRM and proposals, safe to import from browser code (labels, enums, simple rules).

export const ROLES = ["owner", "manager", "employee"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { owner: "مالك", manager: "مدير", employee: "موظف" };

export const STAGES = ["new", "contacted", "meeting", "proposal_sent", "negotiation", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  meeting: "اجتماع وتحديد المتطلبات",
  proposal_sent: "عرض مُرسل",
  negotiation: "تفاوض",
  won: "فاز",
  lost: "خسر",
};
export const OPEN_STAGES = ["new", "contacted", "meeting", "proposal_sent", "negotiation"] as const satisfies readonly Stage[];
export const isOpenStage = (stage: Stage): boolean => (OPEN_STAGES as readonly string[]).includes(stage);

export const SOURCES = ["website", "manual", "referral", "other"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABEL: Record<Source, string> = { website: "الموقع", manual: "إدخال يدوي", referral: "ترشيح", other: "أخرى" };

export const ACTIVITY_KINDS = ["note", "call", "meeting", "whatsapp", "email"] as const;
export type UserActivityKind = (typeof ACTIVITY_KINDS)[number];
export type ActivityKind = UserActivityKind | "stage" | "system";
export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  note: "ملاحظة",
  call: "مكالمة",
  meeting: "اجتماع",
  whatsapp: "واتساب",
  email: "إيميل",
  stage: "تغيير مرحلة",
  system: "النظام",
};

export const LOST_REASONS = ["السعر", "اختار منافسًا", "تأجّل المشروع", "لا يوجد رد", "خارج نطاق خدماتنا"] as const;

export const SERVICES = ["موقع إلكتروني", "تطبيق موبايل", "متجر إلكتروني", "تصميم UI/UX", "أخرى"] as const;

export const CURRENCIES = ["EGP", "USD", "SAR", "AED", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CURRENCY_LABEL: Record<Currency, string> = { EGP: "جنيه مصري", USD: "دولار أمريكي", SAR: "ريال سعودي", AED: "درهم إماراتي", EUR: "يورو" };

export const PROPOSAL_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = { draft: "مسودة", sent: "مُرسل", accepted: "مقبول", rejected: "مرفوض" };

export const PHONE_RE = /^\+?[0-9]{8,15}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** "٠١٠ ٠٠٠-0000" -> "0100000000": ASCII digits only, so stored numbers are comparable and searchable. */
export function normalizePhone(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EASTERN_ARABIC_INDIC.indexOf(digit)))
    .replace(/[\s()\-.]/g, "");
}
