"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Search, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatUsd } from "@/lib/format";
import { previousStage, STAGE_LABEL, STAGES, type Stage } from "@/lib/stages";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { inputClass } from "@/components/ui/Field";
import { RunStatusChip } from "@/components/ui/Status";
import { useToast } from "@/components/ui/Toaster";
import type { BoardCard } from "@/server/services/cards";

const PAGE_FOR_STAGE: Record<Stage, string> = {
  idea: "/script",
  script: "/script",
  filming: "/filming",
  ready: "/posting",
  published: "/posting",
};

const NEXT_ACTION: Record<Stage, string> = {
  idea: "اكتب السكريبت",
  script: "راجع واعتمد",
  filming: "صوّر وامنتج",
  ready: "جهّز للنشر",
  published: "عرض",
};

function CardTile({ card, onRollback }: { card: BoardCard; onRollback: (card: BoardCard) => void }) {
  const running = card.lastRun?.status === "running" || card.lastRun?.status === "queued";
  return (
    <article
      className={cn(
        "group rounded-xl border bg-surface p-3.5 shadow-xs transition-[border-color,box-shadow] duration-(--duration-base) hover:shadow-card",
        running ? "border-primary-500" : "border-line hover:border-line-strong",
      )}
    >
      <p dir="ltr" className="font-mono text-[0.7rem] text-ink-muted">
        {card.slug}
      </p>
      <h3 className="mt-1 text-[0.95rem] leading-6 font-bold">{card.title}</h3>
      {card.ideaQuestion ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{card.ideaQuestion}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {card.lastRun ? <RunStatusChip status={card.lastRun.status} /> : null}
        {card.lastRun?.costUsd ? (
          <span dir="ltr" className="font-mono text-xs text-ink-muted">
            {formatUsd(card.lastRun.costUsd)}
          </span>
        ) : null}
        {card.scheduledAt ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            {formatDateTime(card.scheduledAt)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <Link
          href={`${PAGE_FOR_STAGE[card.stage]}?card=${card.id}`}
          className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
        >
          {NEXT_ACTION[card.stage]}
          <ArrowLeft aria-hidden="true" className="size-3.5 rtl:rotate-0 ltr:rotate-180" />
        </Link>
        {previousStage(card.stage) ? (
          <button
            type="button"
            onClick={() => onRollback(card)}
            aria-label={`إرجاع «${card.title}» للمرحلة السابقة`}
            title="إرجاع للمرحلة السابقة"
            className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-canvas-alt hover:text-ink"
          >
            <Undo2 aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The pipeline as five columns. Cards are NOT draggable on purpose: a card only moves forward when the owner approves
 * on the stage's own page (that's the approval gate), and backwards through the explicit "return" button.
 */
export function Board({ cards }: { cards: BoardCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [rollback, setRollback] = useState<BoardCard | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cards.filter((card) => `${card.title} ${card.slug} ${card.ideaQuestion ?? ""}`.toLowerCase().includes(q)) : cards;
  }, [cards, query]);

  async function confirmRollback() {
    if (!rollback) return;
    setBusy(true);
    try {
      await api(`/api/cards/${rollback.id}/rollback`, { method: "POST" });
      toast.success(`اتنقل «${rollback.title}» للمرحلة السابقة`);
      setRollback(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الإرجاع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Pipeline المحتوى">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm" aria-label="ملخص المراحل">
          {STAGES.map((stage, index) => (
            <li key={stage} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden="true" className="px-1 text-ink-muted/50">/</span> : null}
              <span className="text-ink-muted">{STAGE_LABEL[stage]}</span>
              <span dir="ltr" className="rounded-md bg-canvas-alt px-1.5 font-mono text-xs font-semibold">
                {cards.filter((card) => card.stage === stage).length}
              </span>
            </li>
          ))}
        </ol>
        <div className="relative w-full sm:w-72">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <label htmlFor="board-search" className="sr-only">
            بحث في الكروت
          </label>
          <input id="board-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالعنوان أو الـ slug" className={cn(inputClass, "ps-9")} />
        </div>
      </div>

      <div className="thin-scroll -mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[62rem] grid-cols-5 gap-3">
          {STAGES.map((stage, index) => {
            const inStage = visible.filter((card) => card.stage === stage);
            return (
              <section key={stage} aria-labelledby={`col-${stage}`} className="rounded-xl bg-canvas-alt p-2.5">
                <header className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
                  <h2 id={`col-${stage}`} className="flex items-center gap-2 text-sm font-bold">
                    <span dir="ltr" className="font-mono text-xs text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {STAGE_LABEL[stage]}
                  </h2>
                  <span dir="ltr" className="font-mono text-xs text-ink-muted">
                    {inStage.length}
                  </span>
                </header>
                <div className="grid min-h-24 content-start gap-2.5">
                  {inStage.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line-strong px-3 py-6 text-center text-xs text-ink-muted">
                      {cards.length === 0 ? "—" : query ? "لا نتائج" : "فاضي"}
                    </p>
                  ) : (
                    inStage.map((card) => <CardTile key={card.id} card={card} onRollback={setRollback} />)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <Dialog
        open={rollback !== null}
        onClose={() => !busy && setRollback(null)}
        title="إرجاع الكارت لمرحلة سابقة؟"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRollback(null)} disabled={busy}>
              لا، خلّيه
            </Button>
            <Button onClick={confirmRollback} disabled={busy}>
              نعم، أرجعه
            </Button>
          </>
        }
      >
        {rollback ? (
          <p className="text-ink-muted">
            «{rollback.title}» هيرجع من <strong className="text-ink">{STAGE_LABEL[rollback.stage]}</strong> إلى{" "}
            <strong className="text-ink">{STAGE_LABEL[previousStage(rollback.stage) ?? rollback.stage]}</strong>، وحالة اعتماد الملف المرتبط هترجع «في انتظار الموافقة».
          </p>
        ) : null}
      </Dialog>
    </section>
  );
}
