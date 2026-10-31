import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { content } from "@/content";
import { ecosystem } from "@/config/ecosystem";
import { site } from "@/config/site";
import { EMAIL_RE } from "@/lib/lead-rules";
import { SOCIAL_KEYS, type SiteSettings, type SocialKey } from "@/lib/settings-shape";
import { sql } from "./db";
import { fromJson } from "./sql";

export const SETTINGS_TAG = "settings";
const KEY = "site";

export { SOCIAL_KEYS };
export type { SiteSettings, SocialKey };

const row = (icon: string) => content.contact.info.find((item) => item.icon === icon)?.value ?? "";

/** What the site shows until the admin saves something: the values that live in the code. */
export const DEFAULT_SETTINGS: SiteSettings = {
  whatsappNumber: site.whatsappNumber,
  email: row("mail"),
  workingHours: row("clock"),
  socials: { linkedin: "", x: "", instagram: "", github: "", tiktok: "", youtube: "" },
  seo: { title: content.meta.title, description: content.meta.description },
  ecosystem: Object.fromEntries(ecosystem.map((app) => [app.id, app.enabled])) as SiteSettings["ecosystem"],
};

const httpsUrl = z
  .string()
  .trim()
  .max(200)
  .refine((value) => {
    if (value === "") return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "الرابط لازم يبدأ بـ https://");

export const settingsSchema = z.object({
  whatsappNumber: z
    .string()
    .transform((value) => value.replace(/[\s()\-+]/g, ""))
    .refine((value) => /^[0-9]{8,15}$/.test(value), "رقم واتساب دولي: أرقام فقط من 8 لـ 15 رقم، من غير + أو مسافات"),
  email: z.string().trim().max(254).refine((value) => EMAIL_RE.test(value), "بريد إلكتروني غير صحيح"),
  workingHours: z.string().trim().min(2, "اكتب ساعات العمل").max(120, "الحد الأقصى 120 حرف"),
  socials: z.object(Object.fromEntries(SOCIAL_KEYS.map((key) => [key, httpsUrl])) as Record<SocialKey, typeof httpsUrl>),
  seo: z.object({
    title: z.string().trim().min(5, "العنوان قصير جدًا").max(70, "العنوان أطول من 70 حرف"),
    description: z.string().trim().min(30, "الوصف قصير جدًا (30 حرف على الأقل)").max(200, "الوصف أطول من 200 حرف"),
  }),
  ecosystem: z.object({ marketing: z.boolean(), sales: z.boolean(), crm: z.boolean() }),
});

/**
 * Stored JSON is merged over the defaults, so a missing field just keeps its default. A stored object with ANY invalid
 * field (only possible if someone edited the table by hand) is ignored as a whole, so the site never half-applies it.
 */
export function mergeSettings(stored: unknown): SiteSettings {
  const parsed = settingsSchema.partial().safeParse(stored && typeof stored === "object" ? stored : {});
  const data = parsed.success ? parsed.data : {};
  return {
    whatsappNumber: data.whatsappNumber ?? DEFAULT_SETTINGS.whatsappNumber,
    email: data.email ?? DEFAULT_SETTINGS.email,
    workingHours: data.workingHours ?? DEFAULT_SETTINGS.workingHours,
    socials: { ...DEFAULT_SETTINGS.socials, ...data.socials },
    seo: { ...DEFAULT_SETTINGS.seo, ...data.seo },
    ecosystem: { ...DEFAULT_SETTINGS.ecosystem, ...data.ecosystem },
  };
}

/** Straight from the database (admin screens). Throws if the database is unavailable. */
export async function readSettings(): Promise<SiteSettings> {
  const [stored] = await sql()<{ value: unknown }[]>`select value from settings where name = ${KEY}`;
  return mergeSettings(fromJson(stored?.value));
}

/**
 * What the public pages use. Cached and tagged: saving in the admin calls updateTag("settings"), so changes show
 * immediately; otherwise it refreshes every 5 minutes. If there is no database yet, or it is down, the site simply
 * shows the defaults, so a prerender or a visitor never sees an error page because of this.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 });
  try {
    return await readSettings();
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function writeSettings(settings: SiteSettings): Promise<void> {
  const db = sql();
  // db.json(): the document is sent as JSON text, never as a plain string value.
  await db`
    insert into settings (name, value, updated_at) values (${KEY}, ${db.json(settings)}, now(3))
    on duplicate key update value = values(value), updated_at = now(3)`;
}

export const isPlaceholderWhatsapp = (number: string): boolean => number === site.whatsappNumber;
