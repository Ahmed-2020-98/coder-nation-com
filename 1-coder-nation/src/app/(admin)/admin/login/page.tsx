import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card } from "@/components/admin/ui/Card";
import { getAdmin } from "@/server/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "تسجيل الدخول" };

/** Someone who is already signed in goes straight to the panel instead of seeing the form. */
async function AlreadySignedIn() {
  if (await getAdmin()) redirect("/admin");
  return null;
}

export default function LoginPage() {
  return (
    <main id="main" data-tone="navy" className="glow-corner grid min-h-svh place-items-center bg-canvas px-(--gutter) py-10 text-ink">
      <Suspense>
        <AlreadySignedIn />
      </Suspense>
      <div className="w-full max-w-sm">
        <p dir="ltr" className="mb-6 text-center font-heading text-xl font-bold">
          Coder<span className="text-accent">Nation</span>
        </p>
        <Card data-tone="light" className="p-6 text-ink sm:p-8">
          <h1 className="text-xl font-bold">تسجيل الدخول</h1>
          <p className="mt-1 mb-6 text-sm text-ink-muted">لوحة تحكم الموقع، للفريق فقط.</p>
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}
