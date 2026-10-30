"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveProposalAction } from "@/app/actions/proposals";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass, textareaClass } from "@/components/ui/Field";
import { CURRENCIES, CURRENCY_LABEL, type Currency } from "@/lib/crm-rules";
import { blockingProblems, countPlaceholders } from "@/lib/proposal-rules";
import { computeTotals, formatMoney, parseMoney, splitPayments, toDecimalText } from "@/lib/money";

export type EditorProposal = {
  id: string;
  number: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  title: string;
  currency: Currency;
  taxRateBp: number | null;
  discountMinor: number;
  validUntil: string | null;
  intro: string;
  sections: { title: string; body: string }[];
  timeline: { title: string; weeks: number }[];
  items: { title: string; description: string; quantity: number; unitPriceMinor: number }[];
  milestones: { title: string; percentBp: number }[];
};

type Form = {
  title: string;
  currency: Currency;
  taxPercent: string;
  discount: string;
  validUntil: string;
  intro: string;
  items: { title: string; description: string; quantity: string; price: string }[];
  milestones: { title: string; percent: string }[];
  sections: { title: string; body: string }[];
  timeline: { title: string; weeks: string }[];
};

const bpText = (bp: number) => String(bp / 100);

function initial(p: EditorProposal): Form {
  return {
    title: p.title,
    currency: p.currency,
    taxPercent: p.taxRateBp === null ? "" : bpText(p.taxRateBp),
    discount: p.discountMinor ? toDecimalText(p.discountMinor) : "",
    validUntil: p.validUntil ?? "",
    intro: p.intro,
    items: p.items.map((i) => ({ title: i.title, description: i.description, quantity: String(i.quantity), price: toDecimalText(i.unitPriceMinor) })),
    milestones: p.milestones.map((m) => ({ title: m.title, percent: bpText(m.percentBp) })),
    sections: p.sections,
    timeline: p.timeline.map((t) => ({ title: t.title, weeks: String(t.weeks) })),
  };
}

/** The draft in the shape the shared rules understand; unparseable numbers count as zero (the save step reports them). */
function toDraft(form: Form) {
  const percent = (text: string) => Math.round(Number(text.replace(",", ".")) * 100) || 0;
  return {
    items: form.items.map((i) => ({ title: i.title, quantity: Math.max(1, Math.trunc(Number(i.quantity)) || 1), unitPriceMinor: parseMoney(i.price) ?? 0 })),
    milestones: form.milestones.map((m) => ({ title: m.title, percentBp: percent(m.percent) })),
    discountMinor: form.discount === "" ? 0 : (parseMoney(form.discount) ?? 0),
    taxRateBp: form.taxPercent === "" ? null : percent(form.taxPercent),
    intro: form.intro,
    sections: form.sections,
    timeline: form.timeline.map((t) => ({ title: t.title, weeks: Number(t.weeks) || 1 })),
  };
}

const smallInput = `${inputClass} h-10`;

function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

export function ProposalEditor({ proposal }: { proposal: EditorProposal }) {
  const [form, setForm] = useState<Form>(() => initial(proposal));
  const [saved, setSaved] = useState(() => JSON.stringify(initial(proposal)));
  const locked = proposal.status !== "draft";
  const dirty = JSON.stringify(form) !== saved;

  const draft = useMemo(() => toDraft(form), [form]);
  const totals = useMemo(() => computeTotals(draft.items, draft.discountMinor, draft.taxRateBp), [draft]);
  const percents = draft.milestones.map((m) => m.percentBp);
  const payments = splitPayments(totals.totalMinor, percents);
  const percentSum = percents.reduce((a, b) => a + b, 0);
  const placeholders = countPlaceholders(draft);
  const problems = blockingProblems(draft);
  const money = (minor: number) => formatMoney(minor, form.currency);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const update = <K extends "items" | "milestones" | "sections" | "timeline">(key: K, index: number, patch: Partial<Form[K][number]>) =>
    setForm((f) => ({ ...f, [key]: f[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  const remove = (key: "items" | "milestones" | "sections" | "timeline", index: number) => setForm((f) => ({ ...f, [key]: (f[key] as unknown[]).filter((_, i) => i !== index) }) as Form);

  return (
    <ActionForm action={saveProposalAction} className="grid gap-6" onSuccess={(submitted) => setSaved(String(submitted.get("payload")))}>
      <input type="hidden" name="id" value={proposal.id} />
      <input type="hidden" name="payload" value={JSON.stringify(form)} />
      <fieldset disabled={locked} className="grid min-w-0 gap-6">
        <FormError />
        <Card className="grid gap-5 p-6">
          <h2 className="text-lg font-bold">بيانات العرض</h2>
          <Field label="عنوان العرض" htmlFor="p-title">
            <input id="p-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} className={inputClass} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-4">
            <Field label="العملة" htmlFor="p-currency">
              <select id="p-currency" value={form.currency} onChange={(e) => set("currency", e.target.value as Currency)} className={`${inputClass} cursor-pointer`}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {CURRENCY_LABEL[code]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الضريبة %" htmlFor="p-tax" hint="سيبها فاضية لو مفيش">
              <input id="p-tax" dir="ltr" inputMode="decimal" value={form.taxPercent} onChange={(e) => set("taxPercent", e.target.value)} placeholder="14" className={`${inputClass} text-start`} />
            </Field>
            <Field label="خصم" htmlFor="p-discount">
              <input id="p-discount" dir="ltr" inputMode="decimal" value={form.discount} onChange={(e) => set("discount", e.target.value)} className={`${inputClass} text-start`} />
            </Field>
            <Field label="صلاحية العرض حتى" htmlFor="p-valid">
              <input id="p-valid" type="date" dir="ltr" value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} className={`${inputClass} text-start`} />
            </Field>
          </div>
          <Field label="مقدمة العرض" htmlFor="p-intro" hint="اختياري. بتظهر في أول العرض">
            <textarea id="p-intro" rows={3} value={form.intro} onChange={(e) => set("intro", e.target.value)} maxLength={4000} className={textareaClass} />
          </Field>
        </Card>

        <Card className="grid gap-4 p-6">
          <h2 className="text-lg font-bold">العرض الفني</h2>
          {placeholders > 0 ? (
            <p role="status" className="rounded-lg border border-primary-500/50 bg-accent-soft px-4 py-2.5 text-sm">
              فيه <strong>{placeholders}</strong> مكان لسه فاضي بين أقواس [ ] في النصوص. املاهم قبل ما تصدّر العرض للعميل.
            </p>
          ) : null}
          {form.sections.map((section, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-line p-4">
              <div className="flex items-end gap-2">
                <Field label={`عنوان القسم ${index + 1}`} htmlFor={`s-title-${index}`} className="flex-1">
                  <input id={`s-title-${index}`} value={section.title} onChange={(e) => update("sections", index, { title: e.target.value })} maxLength={120} className={smallInput} />
                </Field>
                <button type="button" aria-label="انقل لفوق" onClick={() => set("sections", move(form.sections, index, -1))} className="h-10 w-10 cursor-pointer rounded-lg border border-line-strong hover:border-accent">↑</button>
                <button type="button" aria-label="انقل لتحت" onClick={() => set("sections", move(form.sections, index, 1))} className="h-10 w-10 cursor-pointer rounded-lg border border-line-strong hover:border-accent">↓</button>
                <button type="button" aria-label={`احذف القسم ${index + 1}`} onClick={() => remove("sections", index)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg border border-line-strong text-error-700 hover:border-error-500">
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
              <Field label="المحتوى" htmlFor={`s-body-${index}`} hint="سطر يبدأ بـ - بيظهر كنقطة">
                <textarea id={`s-body-${index}`} rows={5} value={section.body} onChange={(e) => update("sections", index, { body: e.target.value })} maxLength={6000} className={textareaClass} />
              </Field>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => set("sections", [...form.sections, { title: "", body: "" }])}>
              <Plus aria-hidden="true" className="size-4" />
              قسم جديد
            </Button>
          </div>
        </Card>

        <Card className="grid gap-4 p-6">
          <h2 className="text-lg font-bold">الجدول الزمني</h2>
          {form.timeline.map((phase, index) => (
            <div key={index} className="grid grid-cols-[1fr_6rem_2.5rem] items-end gap-2">
              <Field label={`المرحلة ${index + 1}`} htmlFor={`t-title-${index}`}>
                <input id={`t-title-${index}`} value={phase.title} onChange={(e) => update("timeline", index, { title: e.target.value })} maxLength={200} className={smallInput} />
              </Field>
              <Field label="أسابيع" htmlFor={`t-weeks-${index}`}>
                <input id={`t-weeks-${index}`} dir="ltr" inputMode="numeric" value={phase.weeks} onChange={(e) => update("timeline", index, { weeks: e.target.value })} className={`${smallInput} text-start`} />
              </Field>
              <button type="button" aria-label={`احذف المرحلة ${index + 1}`} onClick={() => remove("timeline", index)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg border border-line-strong text-error-700 hover:border-error-500">
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => set("timeline", [...form.timeline, { title: "", weeks: "1" }])}>
              <Plus aria-hidden="true" className="size-4" />
              مرحلة
            </Button>
          </div>
        </Card>

        <Card className="grid gap-4 p-6">
          <h2 className="text-lg font-bold">العرض المالي</h2>
          {form.items.map((item, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-line p-4">
              <div className="grid items-end gap-2 sm:grid-cols-[1fr_6rem_9rem_2.5rem]">
                <Field label={`البند ${index + 1}`} htmlFor={`i-title-${index}`}>
                  <input id={`i-title-${index}`} value={item.title} onChange={(e) => update("items", index, { title: e.target.value })} maxLength={200} className={smallInput} />
                </Field>
                <Field label="الكمية" htmlFor={`i-qty-${index}`}>
                  <input id={`i-qty-${index}`} dir="ltr" inputMode="numeric" value={item.quantity} onChange={(e) => update("items", index, { quantity: e.target.value })} className={`${smallInput} text-start`} />
                </Field>
                <Field label="سعر الوحدة" htmlFor={`i-price-${index}`}>
                  <input id={`i-price-${index}`} dir="ltr" inputMode="decimal" value={item.price} onChange={(e) => update("items", index, { price: e.target.value })} className={`${smallInput} text-start`} />
                </Field>
                <button type="button" aria-label={`احذف البند ${index + 1}`} onClick={() => remove("items", index)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg border border-line-strong text-error-700 hover:border-error-500">
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
              <Field label="وصف (اختياري)" htmlFor={`i-desc-${index}`}>
                <input id={`i-desc-${index}`} value={item.description} onChange={(e) => update("items", index, { description: e.target.value })} maxLength={1000} className={smallInput} />
              </Field>
              <p className="text-sm text-ink-muted">
                إجمالي البند: <strong className="text-ink">{money(draft.items[index].quantity * draft.items[index].unitPriceMinor)}</strong>
                {parseMoney(item.price) === null ? <span className="text-error-700"> · السعر غير صالح</span> : null}
              </p>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => set("items", [...form.items, { title: "", description: "", quantity: "1", price: "" }])}>
              <Plus aria-hidden="true" className="size-4" />
              بند جديد
            </Button>
          </div>

          <dl className="grid gap-1.5 border-t border-line pt-4 text-sm sm:max-w-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">الإجمالي قبل الخصم</dt><dd>{money(totals.subtotalMinor)}</dd></div>
            {totals.discountMinor > 0 ? <div className="flex justify-between"><dt className="text-ink-muted">الخصم</dt><dd><bdi dir="ltr">- {money(totals.discountMinor)}</bdi></dd></div> : null}
            {draft.taxRateBp !== null ? <div className="flex justify-between"><dt className="text-ink-muted">الضريبة ({form.taxPercent}%)</dt><dd>{money(totals.taxMinor)}</dd></div> : null}
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>الإجمالي</dt><dd>{money(totals.totalMinor)}</dd></div>
          </dl>
        </Card>

        <Card className="grid gap-4 p-6">
          <h2 className="text-lg font-bold">جدول الدفعات</h2>
          {form.milestones.map((milestone, index) => (
            <div key={index} className="grid grid-cols-[1fr_6rem_9rem_2.5rem] items-end gap-2">
              <Field label={`الدفعة ${index + 1}`} htmlFor={`m-title-${index}`}>
                <input id={`m-title-${index}`} value={milestone.title} onChange={(e) => update("milestones", index, { title: e.target.value })} maxLength={200} className={smallInput} />
              </Field>
              <Field label="النسبة %" htmlFor={`m-pct-${index}`}>
                <input id={`m-pct-${index}`} dir="ltr" inputMode="decimal" value={milestone.percent} onChange={(e) => update("milestones", index, { percent: e.target.value })} className={`${smallInput} text-start`} />
              </Field>
              <p className="pb-2 text-sm font-semibold">{money(payments[index] ?? 0)}</p>
              <button type="button" aria-label={`احذف الدفعة ${index + 1}`} onClick={() => remove("milestones", index)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg border border-line-strong text-error-700 hover:border-error-500">
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          ))}
          <p className={percentSum === 10000 ? "text-sm text-success-700" : "text-sm font-semibold text-error-700"}>مجموع النسب: {percentSum / 100}% {percentSum === 10000 ? "✔" : "(لازم يبقى 100%)"}</p>
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => set("milestones", [...form.milestones, { title: "", percent: "" }])}>
              <Plus aria-hidden="true" className="size-4" />
              دفعة
            </Button>
          </div>
        </Card>
      </fieldset>

      <div className="sticky bottom-0 -mx-(--gutter) flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 px-(--gutter) py-3 backdrop-blur">
        {!locked ? (
          <SubmitButton>حفظ العرض</SubmitButton>
        ) : null}
        <ExportLink id={proposal.id} dirty={dirty} locked={locked} problem={problems[0] ?? null} />
        {dirty && !locked ? <span className="text-sm text-ink-muted">فيه تعديلات لسه ما اتحفظتش</span> : null}
      </div>
    </ActionForm>
  );
}

function ExportLink({ id, dirty, locked, problem }: { id: string; dirty: boolean; locked: boolean; problem: string | null }) {
  const blocked = (!locked && dirty) || problem !== null;
  const reason = problem ?? "احفظ التعديلات الأول";
  if (blocked) {
    return (
      <span className="inline-flex flex-col">
        <span aria-disabled="true" className="inline-flex h-11 cursor-not-allowed items-center rounded-lg border border-line-strong px-5 font-semibold text-ink-muted opacity-70">
          تصدير PDF
        </span>
        <span className="mt-1 text-xs text-ink-muted">{reason}</span>
      </span>
    );
  }
  return (
    <a href={`/api/proposals/${id}/pdf`} className="inline-flex h-11 items-center rounded-lg border border-line-strong bg-surface px-5 font-semibold hover:border-accent hover:text-accent">
      تصدير PDF
    </a>
  );
}
