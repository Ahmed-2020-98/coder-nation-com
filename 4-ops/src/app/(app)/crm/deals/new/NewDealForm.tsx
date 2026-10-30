"use client";

import { useState } from "react";
import { createDealAction } from "@/app/actions/crm";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { Card } from "@/components/ui/Card";
import { inputClass, textareaClass } from "@/components/ui/Field";
import { CURRENCIES, CURRENCY_LABEL, SERVICES } from "@/lib/crm-rules";

export function NewDealForm({ clients, users }: { clients: { id: string; name: string; phone: string | null }[]; users: { id: string; name: string }[] }) {
  const [clientId, setClientId] = useState("");
  return (
    <ActionForm action={createDealAction} className="grid max-w-3xl gap-6">
      <FormError />
      <Card className="grid gap-5 p-6">
        <h2 className="text-lg font-bold">العميل</h2>
        <FormField label="عميل موجود" name="clientId" hint="سيبها فاضية لو العميل جديد">
          <select id="clientId" name="clientId" value={clientId} onChange={(event) => setClientId(event.target.value)} className={`${inputClass} cursor-pointer`}>
            <option value="">عميل جديد</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.phone ? ` (${client.phone})` : ""}
              </option>
            ))}
          </select>
        </FormField>
        {clientId === "" ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <FormField label="اسم العميل / الشركة" name="clientName">
              <input id="clientName" name="clientName" maxLength={160} className={inputClass} />
            </FormField>
            <FormField label="الهاتف" name="clientPhone" hint="لو نفس الرقم موجود هيتربط بالعميل القديم">
              <input id="clientPhone" name="clientPhone" dir="ltr" inputMode="tel" className={`${inputClass} text-start`} />
            </FormField>
            <FormField label="الإيميل" name="clientEmail">
              <input id="clientEmail" name="clientEmail" type="email" dir="ltr" className={`${inputClass} text-start`} />
            </FormField>
          </div>
        ) : null}
      </Card>

      <Card className="grid gap-5 p-6">
        <h2 className="text-lg font-bold">الصفقة</h2>
        <FormField label="عنوان الصفقة" name="title">
          <input id="title" name="title" maxLength={200} className={inputClass} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="نوع المشروع" name="service">
            <select id="service" name="service" defaultValue="" className={`${inputClass} cursor-pointer`}>
              <option value="">غير محدد</option>
              {SERVICES.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="المسؤول عن الصفقة" name="ownerId">
            <select id="ownerId" name="ownerId" defaultValue="" className={`${inputClass} cursor-pointer`}>
              <option value="">من غير مسؤول</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="القيمة المتوقعة (اختياري)" name="value">
            <input id="value" name="value" dir="ltr" inputMode="decimal" placeholder="25000" className={`${inputClass} text-start`} />
          </FormField>
          <FormField label="العملة" name="currency">
            <select id="currency" name="currency" defaultValue="EGP" className={`${inputClass} cursor-pointer`}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_LABEL[code]} ({code})
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="تفاصيل / ملاحظات أولية" name="message">
          <textarea id="message" name="message" rows={4} maxLength={2000} className={textareaClass} />
        </FormField>
      </Card>

      <div>
        <SubmitButton size="lg">إنشاء الصفقة</SubmitButton>
      </div>
    </ActionForm>
  );
}
