"use client";

import { LogIn, LogOut } from "lucide-react";
import { checkInAction, checkOutAction } from "@/app/actions/attendance";
import { ActionForm, FormError, SubmitButton } from "@/components/ActionForm";
import { Card } from "@/components/ui/Card";

import type { CheckPhase } from "@/lib/attendance-rules";

const HEADLINE: Record<CheckPhase, string> = {
  in: "لسه ما سجّلتش حضورك",
  out: "حاضر. متنساش تسجّل انصرافك",
  done: "خلصت يومك. تسلم إيدك",
  leave: "عندك إجازة النهارده",
  off: "النهارده يوم راحة",
};

/** The big check-in / check-out button. What can be done is decided on the server; the action checks it again. */
export function CheckCard({ phase, shift, checkedInAt, checkedOutAt, lateMinutes }: { phase: CheckPhase; shift: string; checkedInAt: string | null; checkedOutAt: string | null; lateMinutes: number }) {
  return (
    <Card className="mb-6 p-6">
      <p className="text-sm text-ink-muted">
        الوردية: <span dir="ltr">{shift}</span>
      </p>
      <h2 className="mt-1 text-xl font-bold">{HEADLINE[phase]}</h2>
      {checkedInAt ? (
        <p className="mt-2 text-sm text-ink-muted">
          الحضور <span dir="ltr" className="font-mono font-semibold text-ink">{checkedInAt}</span>
          {lateMinutes > 0 ? <span className="text-error-700"> · متأخر {lateMinutes} دقيقة</span> : null}
          {checkedOutAt ? (
            <>
              {" "}
              · الانصراف <span dir="ltr" className="font-mono font-semibold text-ink">{checkedOutAt}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {phase === "in" || phase === "out" || phase === "leave" || phase === "off" ? (
        <ActionForm key={phase} action={phase === "out" ? checkOutAction : checkInAction} className="mt-5 grid gap-3">
          <FormError />
          <div>
            <SubmitButton size="lg" variant={phase === "out" ? "secondary" : "primary"}>
              {phase === "out" ? <LogOut aria-hidden="true" className="size-5" /> : <LogIn aria-hidden="true" className="size-5" />}
              {phase === "out" ? "سجّل الانصراف" : phase === "in" ? "سجّل الحضور" : "سجّل حضوري برضه"}
            </SubmitButton>
          </div>
        </ActionForm>
      ) : null}
    </Card>
  );
}
