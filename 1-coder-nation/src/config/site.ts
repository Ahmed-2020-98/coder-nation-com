// Fallback settings. The live values come from the admin panel (src/server/settings.ts); these are what the site
// shows until something is saved there, or if the database is unreachable. Visible text lives in src/content.

export const site = {
  // PLACEHOLDER: international format, digits only (no "+" or spaces). The admin panel warns while this is in use.
  whatsappNumber: "201000000000",
};

export function whatsappUrl(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
