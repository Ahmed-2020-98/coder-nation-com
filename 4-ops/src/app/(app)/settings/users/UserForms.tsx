"use client";

import { createUserAction, resetPasswordAction } from "@/app/actions/admin";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { inputClass } from "@/components/ui/Field";
import { ROLES, ROLE_LABEL } from "@/lib/crm-rules";

export function CreateUserForm() {
  return (
    <ActionForm action={createUserAction} persistMessage resetOnSuccess className="grid gap-4">
      <FormError />
      <FormField label="الاسم" name="name">
        <input id="name" name="name" maxLength={80} className={inputClass} />
      </FormField>
      <FormField label="الإيميل" name="email">
        <input id="email" name="email" type="email" dir="ltr" autoComplete="off" className={`${inputClass} text-start`} />
      </FormField>
      <FormField label="الدور" name="role">
        <select id="role" name="role" defaultValue="employee" className={`${inputClass} cursor-pointer`}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
      </FormField>
      <div>
        <SubmitButton>إضافة</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ResetPasswordForm({ id, name }: { id: string; name: string }) {
  return (
    <ActionForm action={resetPasswordAction} persistMessage className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="secondary" aria-label={`باسورد مؤقت جديد لـ ${name}`}>
        باسورد جديد
      </SubmitButton>
    </ActionForm>
  );
}

