"use client";

import { saveCompanyAction } from "@/app/actions/admin";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { inputClass, textareaClass } from "@/components/ui/Field";
import type { Company } from "@/server/company";

export function CompanyForm({ company }: { company: Company }) {
  return (
    <ActionForm action={saveCompanyAction} className="grid gap-5">
      <FormError />
      <FormField label="اسم الشركة" name="name">
        <input id="name" name="name" defaultValue={company.name} maxLength={120} className={inputClass} />
      </FormField>
      <FormField label="العنوان" name="address">
        <textarea id="address" name="address" rows={2} defaultValue={company.address} maxLength={300} className={textareaClass} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="الإيميل" name="email">
          <input id="email" name="email" type="email" dir="ltr" defaultValue={company.email} className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="الهاتف" name="phone">
          <input id="phone" name="phone" dir="ltr" defaultValue={company.phone} maxLength={40} className={`${inputClass} text-start`} />
        </FormField>
      </div>
      <FormField label="الرقم الضريبي" name="taxNumber" hint="بيظهر في العرض لو اتكتب">
        <input id="taxNumber" name="taxNumber" dir="ltr" defaultValue={company.taxNumber} maxLength={40} className={`${inputClass} text-start`} />
      </FormField>
      <div>
        <SubmitButton>حفظ</SubmitButton>
      </div>
    </ActionForm>
  );
}
