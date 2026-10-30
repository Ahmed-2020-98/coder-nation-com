import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { readSettings } from "@/server/settings";
import { SettingsForm } from "./SettingsForm";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "إعدادات الموقع" };

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await readSettings();
  return (
    <>
      <PageHeader title="إعدادات الموقع" description="كل تغيير بيظهر على الموقع العام أول ما تحفظ." />
      <SettingsForm settings={settings} />
    </>
  );
}
