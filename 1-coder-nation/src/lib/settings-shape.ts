// The shape of the site settings, safe to import from browser code (the admin form). The database access, the
// validation and the defaults live in src/server/settings.ts, which must never end up in a client bundle.

export const SOCIAL_KEYS = ["linkedin", "x", "instagram", "github", "tiktok", "youtube"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export type SiteSettings = {
  whatsappNumber: string;
  email: string;
  workingHours: string;
  /** "" = not shown on the site. */
  socials: Record<SocialKey, string>;
  seo: { title: string; description: string };
  ecosystem: Record<"marketing" | "sales" | "crm", boolean>;
};
