import "server-only";

export const isProduction = process.env.NODE_ENV === "production";

/** Public origin of the site (canonical URLs, sitemap, Open Graph). */
export function siteUrl(): string {
  const raw = process.env.SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* fall through to the default */
    }
  }
  return "http://localhost:3000";
}

let devSalt: string | undefined;
/** Secret that makes IP hashes unusable outside this deployment. Required in production, random per process in dev. */
export function ipSalt(): string {
  const configured = process.env.IP_HASH_SALT?.trim();
  if (configured && configured.length >= 16) return configured;
  if (isProduction) throw new Error("IP_HASH_SALT (16+ characters) is required in production");
  return (devSalt ??= `dev-${Math.random().toString(36).slice(2)}${Date.now()}`);
}
