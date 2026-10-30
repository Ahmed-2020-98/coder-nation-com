"use client";

import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { loginAction, type ActionState } from "../actions";
import { Button } from "@/components/admin/ui/Button";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { Field, inputClass } from "@/components/admin/ui/Field";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, null);
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-error-500/50 bg-error-500/10 px-4 py-3 text-sm text-error-700">
          {state.error}
        </p>
      ) : null}
      <Field label="الإيميل" htmlFor="login-email">
        <input id="login-email" name="email" type="email" dir="ltr" autoComplete="username" required autoFocus className={inputClass} />
      </Field>
      <Field label="الباسورد" htmlFor="login-password">
        <PasswordInput id="login-password" name="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
        {pending ? <Loader2 aria-hidden="true" className="spin size-4" /> : <LogIn aria-hidden="true" className="size-4 rtl:-scale-x-100" />}
        {pending ? "جارٍ الدخول…" : "دخول"}
      </Button>
    </form>
  );
}
