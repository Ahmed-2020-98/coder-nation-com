"use client";

import { useState } from "react";
import { BookmarkCheck, GitCompare, History, RotateCcw, Save } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { STYLE_LABEL, type StyleName } from "@/lib/stages";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Status";
import { useToast } from "@/components/ui/Toaster";
import type { DiffLine, StyleView } from "@/server/services/training";

const SOURCE_LABEL: Record<string, string> = {
  baseline: "النسخة الأصلية",
  manual: "تعديل يدوي",
  example: "مثال محفوظ",
  trained: "تغيير حالة التدريب",
  restore: "استرجاع",
};

type Diff = { lines: DiffLine[]; added: number; removed: number };

function Editor({ initial, onChange }: { initial: StyleView; onChange: (view: StyleView) => void }) {
  const toast = useToast();
  const [view, setView] = useState(initial);
  const [content, setContent] = useState(initial.content);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [trainedOpen, setTrainedOpen] = useState(false);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [diff, setDiff] = useState<{ id: number; state: "loading" | "ready" | "error"; data?: Diff; message?: string } | null>(null);

  const dirty = content !== view.content;

  function adopt(next: StyleView) {
    setView(next);
    setContent(next.content);
    onChange(next);
  }

  async function save() {
    setBusy(true);
    try {
      adopt(await api<StyleView>(`/api/style/${view.name}`, { method: "PUT", json: { content, note: note.trim() || null } }));
      setNote("");
      toast.success("اتحفظ الملف وأتسجّلت نسخة في التاريخ");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function setTrained(trained: boolean) {
    setBusy(true);
    try {
      adopt(await api<StyleView>(`/api/style/${view.name}/trained`, { method: "POST", json: { trained } }));
      toast.success(trained ? "اتعلّم الملف كمُدرَّب. المخرجات الجاية مش هتتعلّم «مسودة»." : "رجع الملف لحالة «غير مُدرَّب»");
      setTrainedOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر التغيير");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (restoreId === null) return;
    setBusy(true);
    try {
      adopt(await api<StyleView>(`/api/style/${view.name}/restore`, { method: "POST", json: { snapshotId: restoreId } }));
      toast.success("اتسترجعت النسخة");
      setRestoreId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الاسترجاع");
    } finally {
      setBusy(false);
    }
  }

  async function compare(id: number) {
    setDiff({ id, state: "loading" });
    try {
      const data = await api<Diff>(`/api/style/${view.name}/diff?from=${id}&to=current`);
      setDiff({ id, state: "ready", data });
    } catch (error) {
      setDiff({ id, state: "error", message: error instanceof Error ? error.message : "تعذّر المقارنة" });
    }
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="grid gap-4" aria-label={`تعديل ${view.label}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
          <div className="flex flex-wrap items-center gap-2.5">
            {view.trained ? (
              <Badge tone="success"><BookmarkCheck aria-hidden="true" className="size-3" /> مُدرَّب</Badge>
            ) : (
              <Badge tone="accent">غير مُدرَّب: المخرجات «مسودة قبل التدريب»</Badge>
            )}
            {dirty ? <Badge tone="error">تعديلات غير محفوظة</Badge> : null}
            {view.lastUpdated && view.lastUpdated !== "—" ? <span className="text-xs text-ink-muted">آخر تحديث: <span dir="ltr" className="font-mono">{view.lastUpdated}</span></span> : null}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setTrainedOpen(true)} disabled={busy || dirty}>
            {view.trained ? "رجّعه لغير مُدرَّب" : "علّم كمُدرَّب"}
          </Button>
        </div>

        <Field label={`محتوى ${view.name}.md`} htmlFor="style-content" hint="ملف Markdown بنفس القالب. عدّل الأقسام واكتب أمثلتك. الـ Agents بتقراه ومبتعدّلوش.">
          <textarea
            id="style-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (dirty && !busy) void save();
              }
            }}
            rows={28}
            spellCheck={false}
            dir="auto"
            className="thin-scroll w-full rounded-lg border border-line-strong bg-surface px-4 py-3 font-mono text-[0.85rem] leading-7 text-ink transition-colors hover:border-ink-muted focus:border-accent"
          />
        </Field>

        <div className="sticky bottom-3 z-10 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lift backdrop-blur">
          <Field label="ملاحظة على التعديل (اختياري)" htmlFor="style-note" className="min-w-60 flex-1" hint="لو كتبت ملاحظة بتتسجّل كصف في Training Log.">
            <input id="style-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="مثال: ضفت قاعدة عن الـ Hook" />
          </Field>
          <Button onClick={save} disabled={busy || !dirty}>
            <Save aria-hidden="true" className="size-4" />
            حفظ
          </Button>
        </div>
      </section>

      <aside className="rounded-xl border border-line bg-surface p-4 shadow-card" aria-labelledby="history-title">
        <h2 id="history-title" className="flex items-center gap-2 text-base font-bold">
          <History aria-hidden="true" className="size-4 text-accent" />
          التاريخ
        </h2>
        <ol className="thin-scroll mt-3 grid max-h-[40rem] gap-2 overflow-y-auto">
          {view.history.map((entry, index) => (
            <li key={entry.id} className="rounded-lg border border-line px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <strong>{SOURCE_LABEL[entry.source] ?? entry.source}</strong>
                {index === 0 ? <Badge tone="accent" className="py-0">الحالية</Badge> : null}
              </div>
              <p className="text-xs text-ink-muted">{formatDateTime(entry.createdAt)}</p>
              {entry.note ? <p className="mt-1 text-xs">{entry.note}</p> : null}
              {index > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => compare(entry.id)}>
                    <GitCompare aria-hidden="true" className="size-4" />
                    قارن بالحالي
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setRestoreId(entry.id)} disabled={busy || dirty}>
                    <RotateCcw aria-hidden="true" className="size-4" />
                    استرجع
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </aside>

      <Dialog
        open={trainedOpen}
        onClose={() => !busy && setTrainedOpen(false)}
        title={view.trained ? "تشيل علامة «مُدرَّب»؟" : "تعلّم الملف كمُدرَّب؟"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTrainedOpen(false)} disabled={busy}>إلغاء</Button>
            <Button onClick={() => setTrained(!view.trained)} disabled={busy}>{view.trained ? "شيل العلامة" : "أيوه، مُدرَّب"}</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {view.trained
            ? "المخرجات الجاية هترجع تتعلّم «مسودة قبل التدريب»."
            : "من بعدها الـ Agents هتلتزم بالقواعد والأمثلة في الملف، ومش هتعلّم المخرجات «مسودة قبل التدريب». اعملها لما تكون راضي عن اللي كتبته."}
        </p>
      </Dialog>

      <Dialog
        open={restoreId !== null}
        onClose={() => !busy && setRestoreId(null)}
        title="استرجاع النسخة دي؟"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestoreId(null)} disabled={busy}>إلغاء</Button>
            <Button variant="danger" onClick={restore} disabled={busy}>استرجع</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">الملف الحالي هيتستبدل بالنسخة القديمة، ومحتواه الحالي يفضل في التاريخ لو عايز ترجع له.</p>
      </Dialog>

      <Dialog open={diff !== null} onClose={() => setDiff(null)} title="الفرق بين النسخة والحالي" size="lg">
        {diff?.state === "loading" ? <Skeleton className="h-40" /> : null}
        {diff?.state === "error" ? <p role="alert" className="text-sm text-error-700">{diff.message}</p> : null}
        {diff?.state === "ready" && diff.data ? (
          <div>
            <p className="mb-3 text-sm text-ink-muted">
              <span dir="ltr" className="font-mono text-success-700">+{diff.data.added}</span> سطر مضاف • <span dir="ltr" className="font-mono text-error-700">−{diff.data.removed}</span> سطر محذوف
            </p>
            <pre className="thin-scroll max-h-[28rem] overflow-auto rounded-lg border border-line bg-canvas-alt py-2 text-[0.8rem] leading-6">
              {diff.data.lines.map((line, index) => (
                <div
                  key={index}
                  dir="ltr"
                  className={cn(
                    "flex gap-3 px-3 whitespace-pre-wrap",
                    line.type === "add" && "bg-success-500/15 text-success-700",
                    line.type === "remove" && "bg-error-500/15 text-error-700",
                    line.type === "skip" && "justify-center text-ink-muted",
                  )}
                >
                  {line.type !== "skip" ? <span aria-hidden="true" dir="ltr" className="w-3 shrink-0 font-mono">{line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}</span> : null}
                  {line.type === "add" || line.type === "remove" ? <span className="sr-only">{line.type === "add" ? "مضاف: " : "محذوف: "}</span> : null}
                  <span>{line.text || " "}</span>
                </div>
              ))}
            </pre>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

export function StyleTabs({ views }: { views: StyleView[] }) {
  const [active, setActive] = useState<StyleName>(views[0].name);
  const [state, setState] = useState(() => Object.fromEntries(views.map((view) => [view.name, view])) as Record<StyleName, StyleView>);

  return (
    <div>
      <div role="tablist" aria-label="ملفات الأسلوب" className="mb-5 flex flex-wrap gap-2">
        {views.map((view) => {
          const current = state[view.name];
          return (
            <button
              key={view.name}
              type="button"
              role="tab"
              id={`style-tab-${view.name}`}
              aria-selected={active === view.name}
              aria-controls={`style-panel-${view.name}`}
              onClick={() => setActive(view.name)}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-lg border px-4 text-start transition-colors",
                active === view.name ? "border-primary-500 bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <span>
                <span className="block text-sm font-bold leading-5">{STYLE_LABEL[view.name]}</span>
                <span dir="ltr" className="block font-mono text-xs leading-4 text-ink-muted">{view.name}.md</span>
              </span>
              <Badge tone={current.trained ? "success" : "accent"} className="py-0">{current.trained ? "مُدرَّب" : "مسودة"}</Badge>
            </button>
          );
        })}
      </div>
      {views.map((view) => (
        <div key={view.name} role="tabpanel" id={`style-panel-${view.name}`} aria-labelledby={`style-tab-${view.name}`} hidden={active !== view.name}>
          <Editor initial={view} onChange={(next) => setState((current) => ({ ...current, [next.name]: next }))} />
        </div>
      ))}
    </div>
  );
}
