"use client";

import { duplicateContractAction, respondToContractAction, sendContractAction, withdrawContractAction } from "@/app/actions/contracts";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { Button } from "@/components/ui/Button";
import { Field, textareaClass } from "@/components/ui/Field";

export function SendContract({ id, problem }: { id: string; problem: string | null }) {
  return (
    <ActionForm action={sendContractAction} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <FormError />
      <div>
        <SubmitButton disabled={problem !== null}>ابعت العقد للموظف</SubmitButton>
      </div>
      <p className="text-xs text-ink-muted">{problem ?? "بيقفل العقد للتعديل وبيظهر للموظف في حسابه عشان يوافق عليه. احفظ تعديلاتك الأول."}</p>
    </ActionForm>
  );
}

export function WithdrawContract({ id }: { id: string }) {
  return (
    <ActionForm action={withdrawContractAction} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <FormError />
      <div>
        <SubmitButton variant="secondary">اسحب العقد للتعديل</SubmitButton>
      </div>
      <p className="text-xs text-ink-muted">الموظف لسه ما ردّش. السحب بيرجّعه مسودة ويختفي من عنده لحد ما تبعته تاني.</p>
    </ActionForm>
  );
}

export function DuplicateContract({ id }: { id: string }) {
  return (
    <form action={duplicateContractAction}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" size="sm">
        نسخة جديدة للتعديل
      </Button>
    </form>
  );
}

/** The employee's answer. Accepting needs the explicit "I read it" box; declining can say why. */
export function RespondToContract({ id }: { id: string }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <ActionForm action={respondToContractAction} className="grid content-start gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="answer" value="accepted" />
        <FormError />
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-7">
          <input type="checkbox" name="agree" required className="mt-1.5 size-4 accent-primary-500" />
          قرأت العقد كله وأوافق على كل بنوده.
        </label>
        <div>
          <SubmitButton>أوافق على العقد</SubmitButton>
        </div>
      </ActionForm>
      <ActionForm action={respondToContractAction} className="grid content-start gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="answer" value="declined" />
        <FormError />
        <Field label="عندك اعتراض؟ اكتبه هنا (اختياري)" htmlFor="decline-reason">
          <textarea id="decline-reason" name="reason" rows={3} maxLength={500} className={textareaClass} />
        </Field>
        <div>
          <SubmitButton variant="danger">رفض العقد</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
