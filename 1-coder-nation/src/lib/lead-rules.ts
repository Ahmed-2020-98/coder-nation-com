// Contact-form rules shared by the browser (instant feedback) and the server (the check that actually counts).

export const PHONE_RE = /^\+?[0-9]{8,15}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** "٠١٠ ٠٠٠-0000" -> "0100000000": ASCII digits only, no spaces/dashes/brackets, so stored numbers are searchable. */
export function normalizePhone(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EASTERN_ARABIC_INDIC.indexOf(digit)))
    .replace(/[\s()\-.]/g, "");
}

export const LEAD_LIMITS = { name: { min: 2, max: 120 }, email: 254, message: 2000 } as const;
export const LEAD_STATUSES = ["new", "contacted", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = { new: "جديد", contacted: "تم التواصل", closed: "مغلق" };
