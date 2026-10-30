"use client";

import { addContactAction, saveClientAction } from "@/app/actions/crm";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { inputClass, textareaClass } from "@/components/ui/Field";

export function ClientForm({ client }: { client?: { id: string; name: string; phone: string | null; email: string | null; website: string | null; notes: string } }) {
  return (
    <ActionForm action={saveClientAction} className="grid gap-4">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      <FormError />
      <FormField label="الاسم / الشركة" name="name">
        <input id="name" name="name" defaultValue={client?.name ?? ""} maxLength={160} className={inputClass} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="الهاتف" name="phone">
          <input id="phone" name="phone" dir="ltr" inputMode="tel" defaultValue={client?.phone ?? ""} className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="الإيميل" name="email">
          <input id="email" name="email" type="email" dir="ltr" defaultValue={client?.email ?? ""} className={`${inputClass} text-start`} />
        </FormField>
      </div>
      <FormField label="الموقع" name="website">
        <input id="website" name="website" dir="ltr" defaultValue={client?.website ?? ""} maxLength={200} className={`${inputClass} text-start`} />
      </FormField>
      <FormField label="ملاحظات" name="notes">
        <textarea id="notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} maxLength={4000} className={textareaClass} />
      </FormField>
      <div>
        <SubmitButton size="sm">{client ? "حفظ" : "إضافة العميل"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ContactForm({ clientId }: { clientId: string }) {
  return (
    <ActionForm action={addContactAction} resetOnSuccess className="grid gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <FormError />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="الاسم" name="name">
          <input id="name" name="name" maxLength={120} className={inputClass} />
        </FormField>
        <FormField label="الوظيفة" name="jobTitle">
          <input id="jobTitle" name="jobTitle" maxLength={120} className={inputClass} />
        </FormField>
        <FormField label="الهاتف" name="phone">
          <input id="phone" name="phone" dir="ltr" inputMode="tel" className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="الإيميل" name="email">
          <input id="email" name="email" type="email" dir="ltr" className={`${inputClass} text-start`} />
        </FormField>
      </div>
      <div>
        <SubmitButton size="sm" variant="secondary">
          إضافة جهة اتصال
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
