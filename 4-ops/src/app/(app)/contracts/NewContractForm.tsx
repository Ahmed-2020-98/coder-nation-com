"use client";

import { createContractAction } from "@/app/actions/contracts";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { Field, inputClass } from "@/components/ui/Field";

export function NewContractForm({ people, templates }: { people: { id: string; name: string }[]; templates: { id: string; title: string }[] }) {
  return (
    <ActionForm action={createContractAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="sm:col-span-3">
        <FormError />
      </div>
      <Field label="الموظف" htmlFor="nc-user">
        <select id="nc-user" name="userId" required defaultValue="" className={`${inputClass} cursor-pointer`}>
          <option value="" disabled>
            اختار من الفريق
          </option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="القالب" htmlFor="nc-template">
        <select id="nc-template" name="templateId" defaultValue={templates[0]?.id ?? ""} className={`${inputClass} cursor-pointer`}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
          <option value="">بدون قالب (عقد فاضي)</option>
        </select>
      </Field>
      <SubmitButton>اعمل العقد</SubmitButton>
    </ActionForm>
  );
}
