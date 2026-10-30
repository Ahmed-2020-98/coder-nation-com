"use client";

import { LogIn } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { PasswordInput } from "@/components/PasswordInput";
import { inputClass } from "@/components/ui/Field";

export function LoginForm() {
  return (
    <ActionForm action={loginAction} className="grid gap-5">
      <FormError />
      <FormField label="الإيميل" name="email">
        <input id="email" name="email" type="email" dir="ltr" autoComplete="username" required autoFocus className={inputClass} />
      </FormField>
      <FormField label="الباسورد" name="password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </FormField>
      <SubmitButton size="lg" className="w-full">
        <LogIn aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        دخول
      </SubmitButton>
    </ActionForm>
  );
}
