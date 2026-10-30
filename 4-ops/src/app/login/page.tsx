import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { getUser } from "@/server/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <main id="main" data-tone="navy" className="glow-corner grid min-h-svh place-items-center bg-canvas px-(--gutter) py-10 text-ink">
      <div className="w-full max-w-sm">
        <p dir="ltr" className="mb-6 text-center font-heading text-xl font-bold">
          Coder<span className="text-accent">Nation</span> <span className="text-ink-muted">Ops</span>
        </p>
        <Card data-tone="light" className="p-6 text-ink sm:p-8">
          <h1 className="text-xl font-bold">تسجيل الدخول</h1>
          <p className="mt-1 mb-6 text-sm text-ink-muted">نظام فريق Coder Nation الداخلي.</p>
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}
