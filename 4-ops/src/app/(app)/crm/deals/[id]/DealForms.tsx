"use client";

import { useState } from "react";
import { addActivityAction, addFollowUpAction, assignDealAction, moveDealAction, updateDealAction } from "@/app/actions/crm";
import { ActionForm, FormError, FormField, SubmitButton } from "@/components/ActionForm";
import { inputClass, textareaClass } from "@/components/ui/Field";
import { ACTIVITY_KINDS, ACTIVITY_LABEL, CURRENCIES, CURRENCY_LABEL, LOST_REASONS, SERVICES, STAGES, STAGE_LABEL, type Currency, type Stage } from "@/lib/crm-rules";
import { toDecimalText } from "@/lib/money";

export function MoveForm({ id, stage }: { id: string; stage: Stage }) {
  const [target, setTarget] = useState<Stage>(stage);
  return (
    <ActionForm action={moveDealAction} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <FormField label="المرحلة" name="stage">
        <select id="stage" name="stage" value={target} onChange={(event) => setTarget(event.target.value as Stage)} className={`${inputClass} cursor-pointer`}>
          {STAGES.map((value) => (
            <option key={value} value={value}>
              {STAGE_LABEL[value]}
            </option>
          ))}
        </select>
      </FormField>
      {target === "lost" ? (
        <FormField label="سبب الخسارة" name="lostReason" hint="مطلوب. اختار من الاقتراحات أو اكتب سببك">
          <input id="lostReason" name="lostReason" list="lost-reasons" maxLength={300} className={inputClass} />
          <datalist id="lost-reasons">
            {LOST_REASONS.map((reason) => (
              <option key={reason} value={reason} />
            ))}
          </datalist>
        </FormField>
      ) : null}
      <FormError />
      <div>
        <SubmitButton size="sm" disabled={target === stage}>
          نقل
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AssignForm({ id, ownerId, users }: { id: string; ownerId: string | null; users: { id: string; name: string }[] }) {
  return (
    <ActionForm action={assignDealAction} className="flex items-end gap-3">
      <input type="hidden" name="id" value={id} />
      <FormField label="المسؤول عن الصفقة" name="ownerId" className="flex-1">
        <select id="ownerId" name="ownerId" defaultValue={ownerId ?? ""} className={`${inputClass} cursor-pointer`}>
          <option value="">من غير مسؤول</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </FormField>
      <SubmitButton size="sm" variant="secondary">
        إسناد
      </SubmitButton>
    </ActionForm>
  );
}

export function DealEditForm({ deal }: { deal: { id: string; title: string; service: string | null; valueMinor: number | null; currency: Currency | null } }) {
  return (
    <ActionForm action={updateDealAction} className="grid gap-4">
      <input type="hidden" name="id" value={deal.id} />
      <FormField label="العنوان" name="title">
        <input id="title" name="title" defaultValue={deal.title} maxLength={200} className={inputClass} />
      </FormField>
      <FormField label="نوع المشروع" name="service">
        <select id="service" name="service" defaultValue={deal.service ?? ""} className={`${inputClass} cursor-pointer`}>
          <option value="">غير محدد</option>
          {SERVICES.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="القيمة المتوقعة" name="value">
          <input id="value" name="value" dir="ltr" inputMode="decimal" defaultValue={deal.valueMinor === null ? "" : toDecimalText(deal.valueMinor)} className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="العملة" name="currency">
          <select id="currency" name="currency" defaultValue={deal.currency ?? "EGP"} className={`${inputClass} cursor-pointer`}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {CURRENCY_LABEL[code]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div>
        <SubmitButton size="sm">حفظ</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ActivityForm({ id }: { id: string }) {
  return (
    <ActionForm action={addActivityAction} resetOnSuccess className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <FormField label="النوع" name="kind">
          <select id="kind" name="kind" defaultValue="note" className={`${inputClass} cursor-pointer`}>
            {ACTIVITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ACTIVITY_LABEL[kind]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="التفاصيل" name="body">
          <textarea id="body" name="body" rows={2} maxLength={4000} className={textareaClass} />
        </FormField>
      </div>
      <div>
        <SubmitButton size="sm">إضافة للسجل</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function FollowUpForm({ id }: { id: string }) {
  return (
    <ActionForm action={addFollowUpAction} resetOnSuccess className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="الموعد" name="dueAt">
          <input id="dueAt" name="dueAt" type="datetime-local" dir="ltr" className={`${inputClass} text-start`} />
        </FormField>
        <FormField label="ملاحظة" name="note">
          <input id="note" name="note" maxLength={500} className={inputClass} />
        </FormField>
      </div>
      <div>
        <SubmitButton size="sm" variant="secondary">
          جدولة متابعة
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
