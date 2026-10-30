// Non-copy settings. Visible text lives in src/content.

export const site = {
  // PLACEHOLDER: international format, digits only (no "+" or spaces).
  whatsappNumber: "201000000000",
};

export function whatsappUrl(message: string) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
