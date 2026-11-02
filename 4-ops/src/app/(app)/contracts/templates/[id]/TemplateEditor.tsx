"use client";

import { useState } from "react";
import { saveTemplateAction } from "@/app/actions/contracts";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { ClausesEditor } from "@/components/ClausesEditor";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import type { Clause } from "@/lib/contract-rules";

type Form = { title: string; jobTitle: string; clauses: Clause[] };

export function TemplateEditor({ template }: { template: Form & { id: string } }) {
  const [form, setForm] = useState<Form>({ title: template.title, jobTitle: template.jobTitle, clauses: template.clauses });
  const [saved, setSaved] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== saved;

  return (
    <ActionForm action={saveTemplateAction} className="grid gap-6" onSuccess={(submitted) => setSaved(String(submitted.get("payload")))}>
      <input type="hidden" name="id" value={template.id} />
      <input type="hidden" name="payload" value={JSON.stringify(form)} />
      <FormError />
      <Card className="grid gap-5 p-6 sm:grid-cols-2">
        <Field label="اسم القالب (عنوان العقد)" htmlFor="t-title">
          <input id="t-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} className={inputClass} />
        </Field>
        <Field label="المسمى الوظيفي" htmlFor="t-job">
          <input id="t-job" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} maxLength={120} className={inputClass} />
        </Field>
      </Card>
      <Card className="grid gap-4 p-6">
        <h2 className="text-lg font-bold">البنود</h2>
        <ClausesEditor clauses={form.clauses} onChange={(clauses) => setForm({ ...form, clauses })} />
      </Card>
      <div className="sticky bottom-0 -mx-(--gutter) flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 px-(--gutter) py-3 backdrop-blur">
        <SubmitButton>حفظ القالب</SubmitButton>
        {dirty ? <span className="text-sm text-ink-muted">فيه تعديلات لسه ما اتحفظتش</span> : null}
      </div>
    </ActionForm>
  );
}
