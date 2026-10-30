import type { Metadata } from "next";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "تغيير الباسورد" };

export default async function PasswordPage() {
  const user = await requireUser({ allowMustChange: true });
  return (
    <main id="main" data-tone="navy" className="glow-corner grid min-h-svh place-items-center bg-canvas px-(--gutter) py-10 text-ink">
      <Card data-tone="light" className="w-full max-w-md p-6 text-ink sm:p-8">
        <h1 className="text-xl font-bold">تغيير الباسورد</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          {user.mustChangePassword ? "الباسورد الحالي مؤقت. اختار باسورد جديد عشان تكمّل." : `الحساب: ${user.email}`} (12 حرف على الأقل)
        </p>
        <ChangePasswordForm />
      </Card>
    </main>
  );
}
