"use client";

import { markSentAction, outcomeAction } from "@/app/actions/proposals";
import { duplicateProposalAction } from "@/app/actions/proposals";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { Button } from "@/components/ui/Button";

export function MarkSent({ id }: { id: string }) {
  return (
    <ActionForm action={markSentAction} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <FormError />
      <div>
        <SubmitButton variant="secondary">تم إرسال العرض للعميل</SubmitButton>
      </div>
      <p className="text-xs text-ink-muted">بيقفل العرض للتعديل وبينقل الصفقة لـ«عرض مُرسل». صدّر الـ PDF وابعته الأول.</p>
    </ActionForm>
  );
}

export function Outcome({ id }: { id: string }) {
  return (
    <ActionForm action={outcomeAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <FormError />
      <OutcomeButton outcome="accepted" label="العميل قبل العرض" />
      <OutcomeButton outcome="rejected" label="العميل رفض العرض" danger />
    </ActionForm>
  );
}

function OutcomeButton({ outcome, label, danger }: { outcome: "accepted" | "rejected"; label: string; danger?: boolean }) {
  // Two submit buttons in one form: the clicked one's name/value travels with the form data.
  return (
    <Button
      type="button"
      variant={danger ? "danger" : "secondary"}
      size="sm"
      onClick={(event) => {
        const form = event.currentTarget.closest("form");
        if (!form) return;
        let field = form.querySelector<HTMLInputElement>('input[name="outcome"]');
        if (!field) {
          field = document.createElement("input");
          field.type = "hidden";
          field.name = "outcome";
          form.appendChild(field);
        }
        field.value = outcome;
        form.requestSubmit();
      }}
    >
      {label}
    </Button>
  );
}

export function Duplicate({ id }: { id: string }) {
  return (
    <form action={duplicateProposalAction}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" size="sm">
        نسخة جديدة للتعديل
      </Button>
    </form>
  );
}
