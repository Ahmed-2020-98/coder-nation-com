"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { deleteLeadAction, updateLeadAction, type ActionState } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { Field, inputClass, textareaClass } from "@/components/admin/ui/Field";
import { useToast } from "@/components/admin/ui/Toaster";
import { LEAD_LIMITS, LEAD_STATUSES, STATUS_LABEL, type LeadStatus } from "@/lib/lead-rules";

export function LeadEditor({ id, name, status, note }: { id: string; name: string; status: LeadStatus; note: string }) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(updateLeadAction, null);
  const [, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();
  const shown = useRef<ActionState>(null);

  useEffect(() => {
    if (!state || shown.current === state) return;
    shown.current = state;
    if (state.ok) toast.success("اتحفظ");
    else if (state.error) toast.error(state.error);
  }, [state, toast]);

  // Not `<form action={...}>`: React would reset the fields to their original defaults once the action finishes, so a
  // saved status/note would flip back on screen (and a second click on Save would silently undo it).
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }

  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-5">
        <input type="hidden" name="id" value={id} />
        <Field label="الحالة" htmlFor="lead-status">
          <select id="lead-status" name="status" defaultValue={status} className={`${inputClass} cursor-pointer`}>
            {LEAD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ملاحظة داخلية" htmlFor="lead-note" hint="مش بتظهر للعميل." error={state?.fieldErrors?.note}>
          <textarea id="lead-note" name="note" rows={5} maxLength={LEAD_LIMITS.message} defaultValue={note} className={textareaClass} aria-invalid={state?.fieldErrors?.note ? true : undefined} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? <Loader2 aria-hidden="true" className="spin size-4" /> : <Save aria-hidden="true" className="size-4" />}
            حفظ
          </Button>
          <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" className="size-4" />
            حذف الطلب
          </Button>
        </div>
      </form>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="حذف الطلب؟"
        description="الحذف نهائي ومفيش رجوع فيه."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              إلغاء
            </Button>
            <form action={deleteLeadAction}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit" variant="danger">
                احذف طلب {name}
              </Button>
            </form>
          </>
        }
      >
        <p className="text-sm text-ink-muted">لو عايز تحتفظ ببياناته، صدّرها CSV الأول من صفحة الطلبات.</p>
      </Dialog>
    </>
  );
}
