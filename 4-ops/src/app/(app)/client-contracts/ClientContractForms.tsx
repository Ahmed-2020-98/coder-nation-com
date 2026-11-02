"use client";

import {
  cancelClientContractAction,
  clientContractBackToDraftAction,
  createClientContractAction,
  markClientContractReadyAction,
  markClientContractSignedAction,
  recordPaymentAction,
  voidInvoiceAction,
} from "@/app/actions/client-contracts";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { Field, inputClass, textareaClass } from "@/components/ui/Field";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/client-contract-rules";

const ltrInput = `${inputClass} text-start`;

/** "اعمل عقد" for an accepted proposal, with the template to take the clauses from. */
export function NewClientContractForm({ proposalId, templates }: { proposalId: string; templates: { id: string; title: string }[] }) {
  return (
    <ActionForm action={createClientContractAction} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="proposalId" value={proposalId} />
      <div className="sm:col-span-2">
        <FormError />
      </div>
      <Field label="قالب البنود" htmlFor={`nc-template-${proposalId}`}>
        <select id={`nc-template-${proposalId}`} name="templateId" defaultValue={templates[0]?.id ?? ""} className={`${inputClass} cursor-pointer`}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
          <option value="">بدون بنود (أكتبها بنفسي)</option>
        </select>
      </Field>
      <SubmitButton>اعمل العقد</SubmitButton>
    </ActionForm>
  );
}

export function MarkReady({ id, problem }: { id: string; problem: string | null }) {
  return (
    <ActionForm action={markClientContractReadyAction} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <FormError />
      <div>
        <SubmitButton disabled={problem !== null}>العقد جاهز للتوقيع</SubmitButton>
      </div>
      <p className="text-xs text-ink-muted">{problem ?? "بيقفل العقد للتعديل عشان النسخة اللي هتتطبع تفضل زي ما هي. احفظ تعديلاتك الأول."}</p>
    </ActionForm>
  );
}

export function BackToDraft({ id }: { id: string }) {
  return (
    <ActionForm action={clientContractBackToDraftAction} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <FormError />
      <div>
        <SubmitButton variant="secondary" size="sm">
          رجّعه مسودة للتعديل
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/** The day the client signed the printed copy, and who signed for them. */
export function SignForm({ id, today, defaultName }: { id: string; today: string; defaultName: string }) {
  return (
    <ActionForm action={markClientContractSignedAction} className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="id" value={id} />
      <div className="sm:col-span-3">
        <FormError />
      </div>
      <Field label="تاريخ التوقيع" htmlFor="sign-on">
        <input id="sign-on" name="signedOn" type="date" dir="ltr" required defaultValue={today} max={today} className={ltrInput} />
      </Field>
      <Field label="وقّع عن العميل" htmlFor="sign-by">
        <input id="sign-by" name="signedByName" required minLength={2} maxLength={120} defaultValue={defaultName} className={inputClass} />
      </Field>
      <SubmitButton>العميل وقّع</SubmitButton>
    </ActionForm>
  );
}

export function CancelContract({ id }: { id: string }) {
  return (
    <ActionForm action={cancelClientContractAction} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <FormError />
      <Field label="سبب الإلغاء" htmlFor="cancel-reason">
        <input id="cancel-reason" name="reason" required minLength={2} maxLength={300} className={inputClass} />
      </Field>
      <div>
        <SubmitButton variant="danger" size="sm">
          الغي العقد
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * Money the client sent. The amount starts at the next unpaid payment of the schedule (or what is left); the person
 * types what actually arrived. Saving issues the invoice and opens it.
 */
export function PaymentForm({
  contractId,
  today,
  defaultAmount,
  defaultMilestone,
  milestones,
  currency,
}: {
  contractId: string;
  today: string;
  defaultAmount: string;
  defaultMilestone: number | null;
  milestones: { title: string; remaining: string }[];
  currency: string;
}) {
  return (
    <ActionForm action={recordPaymentAction} className="grid gap-4">
      <input type="hidden" name="contractId" value={contractId} />
      <FormError />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={`المبلغ اللي وصل (${currency})`} htmlFor="pay-amount">
          <input id="pay-amount" name="amount" dir="ltr" inputMode="decimal" required defaultValue={defaultAmount} className={ltrInput} />
        </Field>
        <Field label="تاريخ الدفع" htmlFor="pay-on">
          <input id="pay-on" name="paidOn" type="date" dir="ltr" required defaultValue={today} max={today} className={ltrInput} />
        </Field>
        <Field label="طريقة الدفع" htmlFor="pay-method">
          <select id="pay-method" name="method" defaultValue="bank_transfer" className={`${inputClass} cursor-pointer`}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="عن أنهي دفعة؟" htmlFor="pay-milestone">
          <select id="pay-milestone" name="milestoneIndex" defaultValue={defaultMilestone === null ? "" : String(defaultMilestone)} className={`${inputClass} cursor-pointer`}>
            {milestones.map((m, index) => (
              <option key={index} value={index}>
                {m.title} (متبقي {m.remaining})
              </option>
            ))}
            <option value="">من غير دفعة محددة</option>
          </select>
        </Field>
        <Field label="رقم العملية / المرجع" htmlFor="pay-ref" hint="اختياري">
          <input id="pay-ref" name="reference" dir="ltr" maxLength={120} className={ltrInput} />
        </Field>
      </div>
      <Field label="ملاحظة على الفاتورة" htmlFor="pay-note" hint="اختياري، بتظهر في الفاتورة">
        <textarea id="pay-note" name="note" rows={2} maxLength={500} className={textareaClass} />
      </Field>
      <div>
        <SubmitButton>سجّل الدفعة وطلّع الفاتورة</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function VoidInvoice({ id }: { id: string }) {
  return (
    <ActionForm action={voidInvoiceAction} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <FormError />
      <Field label="سبب الإلغاء" htmlFor="void-reason" hint="مثال: المبلغ اتسجّل بالغلط">
        <input id="void-reason" name="reason" required minLength={2} maxLength={300} className={inputClass} />
      </Field>
      <div>
        <SubmitButton variant="danger" size="sm">
          الغي الفاتورة
        </SubmitButton>
      </div>
      <p className="text-xs text-ink-muted">الفاتورة مش بتتمسح: بتفضل برقمها وعليها «ملغاة»، والمبلغ بيخرج من المدفوع على العقد.</p>
    </ActionForm>
  );
}
