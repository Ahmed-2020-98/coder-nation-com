import { ar } from "./ar";

// Register new languages here (e.g. `en`) and switch `defaultLocale`, or resolve it per request later.
export const locales = { ar } as const;

export type Locale = keyof typeof locales;
export type SiteContent = typeof ar;

export const defaultLocale: Locale = "ar";
export const content: SiteContent = locales[defaultLocale];
