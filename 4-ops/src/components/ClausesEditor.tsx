"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, inputClass, textareaClass } from "@/components/ui/Field";
import { TOKENS, type Clause } from "@/lib/contract-rules";

const smallInput = `${inputClass} h-10`;
const iconButton = "grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-line-strong hover:border-accent";

function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

/**
 * The numbered clauses of a template or a contract: title + text each, reorderable, with the token cheat sheet.
 * `tokens` defaults to the employee contract's; client contracts pass their own.
 */
export function ClausesEditor({ clauses, onChange, tokens = TOKENS }: { clauses: Clause[]; onChange: (next: Clause[]) => void; tokens?: readonly { token: string; label: string }[] }) {
  const update = (index: number, patch: Partial<Clause>) => onChange(clauses.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  return (
    <div className="grid gap-4">
      <details className="rounded-lg border border-line bg-canvas-alt px-4 py-2.5 text-sm">
        <summary className="cursor-pointer font-semibold">كلمات بتتملي لوحدها من بيانات العقد</summary>
        <p className="mt-2 text-ink-muted">اكتب الكلمة بين القوسين زي ما هي جوه أي بند، وهتتبدّل بقيمتها في العقد. السطر اللي بيبدأ بـ - بيظهر كنقطة.</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {tokens.map(({ token, label }) => (
            <li key={token}>
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">{token}</code> {label}
            </li>
          ))}
        </ul>
      </details>
      {clauses.map((clause, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-line p-4">
          <div className="flex items-end gap-2">
            <Field label={`البند ${index + 1}`} htmlFor={`c-title-${index}`} className="flex-1">
              <input id={`c-title-${index}`} value={clause.title} onChange={(e) => update(index, { title: e.target.value })} maxLength={120} className={smallInput} />
            </Field>
            <button type="button" aria-label={`انقل البند ${index + 1} لفوق`} onClick={() => onChange(move(clauses, index, -1))} className={iconButton}>
              ↑
            </button>
            <button type="button" aria-label={`انقل البند ${index + 1} لتحت`} onClick={() => onChange(move(clauses, index, 1))} className={iconButton}>
              ↓
            </button>
            <button type="button" aria-label={`احذف البند ${index + 1}`} onClick={() => onChange(clauses.filter((_, i) => i !== index))} className={`${iconButton} text-error-700 hover:border-error-500`}>
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
          <Field label="النص" htmlFor={`c-body-${index}`}>
            <textarea id={`c-body-${index}`} rows={6} value={clause.body} onChange={(e) => update(index, { body: e.target.value })} maxLength={6000} className={textareaClass} />
          </Field>
        </div>
      ))}
      <div>
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...clauses, { title: "", body: "" }])}>
          <Plus aria-hidden="true" className="size-4" />
          بند جديد
        </Button>
      </div>
    </div>
  );
}
