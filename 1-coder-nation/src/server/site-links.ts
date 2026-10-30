import type { SiteSettings } from "./settings";
import { content } from "@/content";

/** The "email / working hours" rows with the admin's values in place of the ones written in the code. */
export function contactRows(settings: Pick<SiteSettings, "email" | "workingHours">) {
  return content.contact.info.map((row) => {
    if (row.icon === "mail") return { ...row, value: settings.email };
    if (row.icon === "clock") return { ...row, value: settings.workingHours };
    return row;
  });
}
