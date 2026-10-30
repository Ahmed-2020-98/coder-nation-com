"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { moveDealAction } from "@/app/actions/crm";
import { useToast } from "@/components/ui/Toaster";
import { OPEN_STAGES, STAGE_LABEL, type Stage } from "@/lib/crm-rules";

/** Moves a deal from the board with one choice. Losing a deal needs a reason, so that happens on the deal page. */
export function QuickMove({ id, stage }: { id: string; stage: Stage }) {
  const [state, dispatch, pending] = useActionState(moveDealAction, null);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const shown = useRef(state);

  useEffect(() => {
    if (!state || shown.current === state) return;
    shown.current = state;
    if (state.error) toast.error(state.error);
  }, [state, toast]);

  return (
    <label className="block text-xs text-ink-muted">
      <span className="sr-only">انقل الصفقة إلى</span>
      <select
        value={stage}
        disabled={pending}
        aria-label="انقل إلى"
        onChange={(event) => {
          const data = new FormData();
          data.set("id", id);
          data.set("stage", event.target.value);
          startTransition(() => dispatch(data));
        }}
        className="h-9 w-full cursor-pointer rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink focus:border-accent disabled:opacity-60"
      >
        {[...OPEN_STAGES, "won" as const].map((value) => (
          <option key={value} value={value}>
            {STAGE_LABEL[value]}
          </option>
        ))}
        {stage === "lost" ? <option value="lost">{STAGE_LABEL.lost}</option> : null}
      </select>
    </label>
  );
}
