"use client";

import { useMemo, useState } from "react";
import { saveClientContractAction } from "@/app/actions/client-contracts";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { ClausesEditor } from "@/components/ClausesEditor";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { CLIENT_TOKENS, clientContractProblems, type ClientContractFacts } from "@/lib/client-contract-rules";
import type { Clause } from "@/lib/contract-rules";

type Form = {
  title: string;
  clientName: string;
  clientRepresentative: string;
  clientIdNumber: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;
  startDate: string;
  clauses: Clause[];
};

/** The draft's fields, plus the facts the clause tokens need (company name, proposal number, total, timeline). */
export type EditorClientContract = Omit<Form, "startDate"> & { id: string; startDate: string | null } & Omit<ClientContractFacts, "title" | "clientName" | "startDate">;

const ltrInput = `${inputClass} text-start`;

/** The draft's own fields: the client's details, the start date and the clauses. Prices and scope come from the proposal. */
export function ClientContractEditor({ contract }: { contract: EditorClientContract }) {
  const initial: Form = {
    title: contract.title,
    clientName: contract.clientName,
    clientRepresentative: contract.clientRepresentative,
    clientIdNumber: contract.clientIdNumber,
    clientAddress: contract.clientAddress,
    clientPhone: contract.clientPhone,
    clientEmail: contract.clientEmail,
    startDate: contract.startDate ?? "",
    clauses: contract.clauses,
  };
  const [form, setForm] = useState<Form>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(form) !== saved;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const problems = useMemo(() => clientContractProblems({ ...contract, ...form, startDate: form.startDate || null }), [contract, form]);
  const text = (key: Exclude<keyof Form, "clauses" | "startDate">, label: string, extra: { ltr?: boolean; max: number; hint?: string; type?: string }) => (
    <Field label={label} htmlFor={`cc-${key}`} hint={extra.hint}>
      <input
        id={`cc-${key}`}
        type={extra.type ?? "text"}
        dir={extra.ltr ? "ltr" : undefined}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        maxLength={extra.max}
        className={extra.ltr ? ltrInput : inputClass}
      />
    </Field>
  );

  return (
    <ActionForm action={saveClientContractAction} className="grid gap-6" onSuccess={(submitted) => setSaved(String(submitted.get("payload")))}>
      <input type="hidden" name="id" value={contract.id} />
      <input type="hidden" name="payload" value={JSON.stringify(form)} />
      <FormError />
      <Card className="grid gap-5 p-6">
        <h2 className="text-lg font-bold">بيانات العقد والعميل</h2>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
          {text("title", "عنوان العقد (اسم المشروع)", { max: 200 })}
          <Field label="تاريخ بدء التنفيذ" htmlFor="cc-start">
            <input id="cc-start" type="date" dir="ltr" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={ltrInput} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("clientName", "اسم العميل (شركة أو شخص)", { max: 160 })}
          {text("clientRepresentative", "يمثّله", { max: 120, hint: "اختياري: اسم ووظيفة اللي هيوقّع" })}
          {text("clientIdNumber", "رقم السجل التجاري / الرقم القومي", { ltr: true, max: 40, hint: "اختياري" })}
          {text("clientAddress", "العنوان", { max: 300 })}
          {text("clientPhone", "الموبايل", { ltr: true, max: 30, type: "tel" })}
          {text("clientEmail", "الإيميل", { ltr: true, max: 254, type: "email" })}
        </div>
      </Card>

      <Card className="grid gap-4 p-6">
        <h2 className="text-lg font-bold">البنود</h2>
        <p className="text-sm text-ink-muted">النطاق والجدول الزمني والأسعار والدفعات بتتطبع لوحدها كملاحق من العرض. هنا البنود القانونية بس. كمّل أي فراغ بين [ ].</p>
        <ClausesEditor clauses={form.clauses} onChange={(clauses) => set("clauses", clauses)} tokens={CLIENT_TOKENS} />
      </Card>

      <div className="sticky bottom-0 -mx-(--gutter) flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 px-(--gutter) py-3 backdrop-blur">
        <SubmitButton>حفظ العقد</SubmitButton>
        {dirty ? <span className="text-sm text-ink-muted">فيه تعديلات لسه ما اتحفظتش</span> : null}
        {!dirty && problems.length > 0 ? <span className="text-sm text-ink-muted">قبل ما يبقى جاهز: {problems[0]}</span> : null}
      </div>
    </ActionForm>
  );
}
