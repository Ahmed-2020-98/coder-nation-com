"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { createTokenAction } from "@/app/actions/api-tokens";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

function CopyBox({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 items-stretch gap-2">
      <code dir="ltr" className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-canvas-alt px-3 py-2.5 font-mono text-sm whitespace-nowrap">
        {value}
      </code>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={label}
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => setCopied(true));
        }}
      >
        {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
        {copied ? "اتنسخ" : "نسخ"}
      </Button>
    </div>
  );
}

/** New key: name + lifetime. The key is shown here once, with the command that connects Claude Code to it. */
export function NewTokenForm({ endpoint }: { endpoint: string }) {
  const [state, action, pending] = useActionState(createTokenAction, null);
  return (
    // min-w-0: the one-line key and command must scroll inside their box, not widen the card.
    <div className="grid min-w-0 gap-5">
      <form action={action} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <Field label="اسم المفتاح" htmlFor="token-name" hint="عشان تعرف بيتستخدم فين، مثلًا: Claude على لابتوب أحمد">
          <input id="token-name" name="name" required minLength={2} maxLength={80} className={inputClass} />
        </Field>
        <Field label="صالح لمدة" htmlFor="token-days">
          <select id="token-days" name="days" defaultValue="90" className={`${inputClass} cursor-pointer`}>
            <option value="30">30 يوم</option>
            <option value="90">90 يوم</option>
            <option value="365">سنة</option>
          </select>
        </Field>
        <Button type="submit" disabled={pending}>
          <KeyRound aria-hidden="true" className="size-4" />
          اعمل مفتاح
        </Button>
      </form>
      {state?.error ? (
        <p role="alert" className="rounded-lg border border-error-500/50 bg-error-500/10 px-4 py-3 text-sm text-error-700">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.token ? (
        <div role="status" className="grid min-w-0 gap-3 rounded-xl border border-primary-500/50 bg-accent-soft p-5">
          <p className="font-semibold">{state.message}</p>
          <CopyBox value={state.token} label="نسخ المفتاح" />
          <p className="text-sm text-ink-muted">وصّل Claude Code بيه: شغّل الأمر ده في الـ Terminal (فيه المفتاح، فماتبعتهوش لحد).</p>
          <CopyBox value={`claude mcp add --transport http coder-ops ${endpoint} --header "Authorization: Bearer ${state.token}"`} label="نسخ أمر الربط" />
        </div>
      ) : null}
    </div>
  );
}
