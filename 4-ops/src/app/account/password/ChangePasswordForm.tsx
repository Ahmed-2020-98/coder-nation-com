"use client";

import { changePasswordAction } from "@/app/actions/auth";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { PasswordInput } from "@/components/PasswordInput";

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePasswordAction} className="grid gap-5">
      <FormError />
      <FormField label="الباسورد الحالي" name="current">
        <PasswordInput id="current" name="current" autoComplete="current-password" required />
      </FormField>
      <FormField label="الباسورد الجديد" name="next">
        <PasswordInput id="next" name="next" autoComplete="new-password" required minLength={12} />
      </FormField>
      <FormField label="كرّر الباسورد الجديد" name="repeat">
        <PasswordInput id="repeat" name="repeat" autoComplete="new-password" required />
      </FormField>
      <SubmitButton size="lg">حفظ</SubmitButton>
    </ActionForm>
  );
}
