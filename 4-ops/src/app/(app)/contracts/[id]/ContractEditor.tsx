"use client";

import { useMemo, useState } from "react";
import { saveContractAction } from "@/app/actions/contracts";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { ClausesEditor } from "@/components/ClausesEditor";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { WEEKDAY_LABEL } from "@/lib/attendance-rules";
import { contractProblems, type Clause } from "@/lib/contract-rules";
import { CURRENCIES, CURRENCY_LABEL, type Currency } from "@/lib/crm-rules";
import { parseMoney, toDecimalText } from "@/lib/money";

export type EditorContract = {
  id: string;
  status: "draft" | "sent" | "accepted" | "declined";
  title: string;
  employeeName: string;
  jobTitle: string;
  phone: string;
  email: string;
  nationalId: string;
  address: string;
  startDate: string | null;
  workStart: string;
  workEnd: string;
  workDays: number[];
  salaryMinor: number | null;
  currency: Currency;
  commission: string;
  clauses: Clause[];
};

type Form = Omit<EditorContract, "id" | "status" | "startDate" | "salaryMinor"> & { startDate: string; salary: string };

const initial = (c: EditorContract): Form => ({
  title: c.title,
  employeeName: c.employeeName,
  jobTitle: c.jobTitle,
  phone: c.phone,
  email: c.email,
  nationalId: c.nationalId,
  address: c.address,
  startDate: c.startDate ?? "",
  workStart: c.workStart,
  workEnd: c.workEnd,
  workDays: c.workDays,
  salary: c.salaryMinor === null ? "" : toDecimalText(c.salaryMinor),
  currency: c.currency,
  commission: c.commission,
  clauses: c.clauses,
});

const ltrInput = `${inputClass} text-start`;

export function ContractEditor({ contract }: { contract: EditorContract }) {
  const [form, setForm] = useState<Form>(() => initial(contract));
  const [saved, setSaved] = useState(() => JSON.stringify(initial(contract)));
  const locked = contract.status !== "draft";
  const dirty = JSON.stringify(form) !== saved;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const problems = useMemo(
    () => contractProblems({ ...form, startDate: form.startDate || null, salaryMinor: form.salary === "" ? null : parseMoney(form.salary) }),
    [form],
  );
  const text = (key: "title" | "employeeName" | "jobTitle" | "phone" | "email" | "nationalId" | "address" | "commission", label: string, extra: { ltr?: boolean; max: number; hint?: string; type?: string }) => (
    <Field label={label} htmlFor={`k-${key}`} hint={extra.hint}>
      <input
        id={`k-${key}`}
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
    <ActionForm action={saveContractAction} className="grid gap-6" onSuccess={(submitted) => setSaved(String(submitted.get("payload")))}>
      <input type="hidden" name="id" value={contract.id} />
      <input type="hidden" name="payload" value={JSON.stringify(form)} />
      <fieldset disabled={locked} className="grid min-w-0 gap-6">
        <FormError />
        <Card className="grid gap-5 p-6">
          <h2 className="text-lg font-bold">بيانات الموظف</h2>
          {text("title", "عنوان العقد", { max: 200 })}
          <div className="grid gap-5 sm:grid-cols-2">
            {text("employeeName", "الاسم بالكامل", { max: 120 })}
            {text("jobTitle", "المسمى الوظيفي", { max: 120 })}
            {text("phone", "الموبايل", { ltr: true, max: 30, type: "tel" })}
            {text("email", "الإيميل", { ltr: true, max: 254, type: "email" })}
            {text("nationalId", "الرقم القومي", { ltr: true, max: 30 })}
            {text("address", "العنوان", { max: 300 })}
          </div>
        </Card>

        <Card className="grid gap-5 p-6">
          <h2 className="text-lg font-bold">المواعيد والمقابل</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="تاريخ البدء" htmlFor="k-start">
              <input id="k-start" type="date" dir="ltr" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={ltrInput} />
            </Field>
            <Field label="بداية الدوام" htmlFor="k-from">
              <input id="k-from" type="time" dir="ltr" value={form.workStart} onChange={(e) => set("workStart", e.target.value)} className={ltrInput} />
            </Field>
            <Field label="نهاية الدوام" htmlFor="k-to">
              <input id="k-to" type="time" dir="ltr" value={form.workEnd} onChange={(e) => set("workEnd", e.target.value)} className={ltrInput} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">أيام العمل</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABEL.map((label, day) => {
                const checked = form.workDays.includes(day);
                return (
                  <label key={day} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line-strong px-3 text-sm has-checked:border-accent has-checked:bg-accent-soft">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => set("workDays", checked ? form.workDays.filter((d) => d !== day) : [...form.workDays, day].sort((a, b) => a - b))}
                      className="size-4 accent-primary-500"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
            <Field label="المرتب الشهري" htmlFor="k-salary" hint="سيبه فاضي لو بالعمولة بس">
              <input id="k-salary" dir="ltr" inputMode="decimal" value={form.salary} onChange={(e) => set("salary", e.target.value)} className={ltrInput} />
            </Field>
            <Field label="العملة" htmlFor="k-currency">
              <select id="k-currency" value={form.currency} onChange={(e) => set("currency", e.target.value as Currency)} className={`${inputClass} cursor-pointer`}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {CURRENCY_LABEL[code]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {text("commission", "العمولة", { max: 500, hint: "اختياري. مثال: 5% من قيمة كل صفقة يقفلها بعد تحصيل العربون" })}
        </Card>

        <Card className="grid gap-4 p-6">
          <h2 className="text-lg font-bold">البنود</h2>
          <ClausesEditor clauses={form.clauses} onChange={(clauses) => set("clauses", clauses)} />
        </Card>
      </fieldset>

      <div className="sticky bottom-0 -mx-(--gutter) flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 px-(--gutter) py-3 backdrop-blur">
        {!locked ? <SubmitButton>حفظ العقد</SubmitButton> : null}
        {dirty && !locked ? <span className="text-sm text-ink-muted">فيه تعديلات لسه ما اتحفظتش</span> : null}
        {!dirty && !locked && problems.length > 0 ? <span className="text-sm text-ink-muted">قبل الإرسال: {problems[0]}</span> : null}
      </div>
    </ActionForm>
  );
}
