"use client";

import { useState } from "react";
import { saveClientTemplateAction } from "@/app/actions/client-contracts";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { ClausesEditor } from "@/components/ClausesEditor";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { CLIENT_TOKENS } from "@/lib/client-contract-rules";
import type { Clause } from "@/lib/contract-rules";

type Form = { title: string; clauses: Clause[] };

export function ClientTemplateEditor({ template }: { template: Form & { id: string } }) {
  const [form, setForm] = useState<Form>({ title: template.title, clauses: template.clauses });
  const [saved, setSaved] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== saved;

  return (
    <ActionForm action={saveClientTemplateAction} className="grid gap-6" onSuccess={(submitted) => setSaved(String(submitted.get("payload")))}>
      <input type="hidden" name="id" value={template.id} />
      <input type="hidden" name="payload" value={JSON.stringify(form)} />
      <FormError />
      <Card className="grid gap-5 p-6">
        <Field label="اسم القالب" htmlFor="ct-title">
          <input id="ct-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} className={inputClass} />
        </Field>
      </Card>
      <Card className="grid gap-4 p-6">
        <h2 className="text-lg font-bold">البنود</h2>
        <ClausesEditor clauses={form.clauses} onChange={(clauses) => setForm({ ...form, clauses })} tokens={CLIENT_TOKENS} />
      </Card>
      <div className="sticky bottom-0 -mx-(--gutter) flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 px-(--gutter) py-3 backdrop-blur">
        <SubmitButton>حفظ القالب</SubmitButton>
        {dirty ? <span className="text-sm text-ink-muted">فيه تعديلات لسه ما اتحفظتش</span> : null}
      </div>
    </ActionForm>
  );
}
