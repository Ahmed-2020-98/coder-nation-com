/** wa.me needs the international number. Only numbers written with + or 00 qualify; a local "0100…" is ambiguous, so no link. */
export function whatsappLinkFor(phone: string): string | null {
  if (/^\+[0-9]{8,15}$/.test(phone)) return `https://wa.me/${phone.slice(1)}`;
  if (/^00[0-9]{8,15}$/.test(phone)) return `https://wa.me/${phone.slice(2)}`;
  return null;
}

const DATE = new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });
export function formatDateTime(value: Date): string {
  return DATE.format(value);
}
