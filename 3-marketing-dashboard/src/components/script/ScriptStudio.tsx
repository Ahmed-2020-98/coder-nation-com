"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Check, Clock, Lock, PenLine, Save, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { countWords, describeDuration } from "@/lib/script-math";
import { STAGE_LABEL } from "@/lib/stages";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, textareaClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toaster";
import { RunPanel } from "@/components/runs/RunPanel";
import type { Run } from "@/server/db";
import type { ScriptView } from "@/server/services/script";

type Parts = { hook: string; body: string; cta: string };

const SECTIONS: { key: keyof Parts; label: string; hint: string; rows: number }[] = [
  { key: "hook", label: "Hook", hint: "أول 3 ثواني: اللي يخلّي المشاهد يكمّل", rows: 3 },
  { key: "body", label: "المحتوى", hint: "إجابة السؤال بوضوح", rows: 9 },
  { key: "cta", label: "CTA", hint: "الخطوة اللي عايز المشاهد يعملها", rows: 3 },
];

function Editor({ view }: { view: ScriptView }) {
  const router = useRouter();
  const toast = useToast();
  const script = view.script!;
  const card = view.card;

  const [saved, setSaved] = useState<Parts>({ hook: script.parts.hook, body: script.parts.body, cta: script.parts.cta });
  const [parts, setParts] = useState<Parts>(saved);
  const [busy, setBusy] = useState<null | "save" | "approve" | "example">(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [forceOpen, setForceOpen] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);

  const dirty = parts.hook !== saved.hook || parts.body !== saved.body || parts.cta !== saved.cta;
  const duration = useMemo(() => describeDuration(parts, view.style.rate), [parts, view.style.rate]);
  const editable = script.editable;
  const approved = card.stage !== "script" && card.stage !== "idea";

  async function save(): Promise<boolean> {
    setBusy("save");
    try {
      await api<ScriptView>(`/api/script/${card.id}`, { method: "PUT", json: parts });
      setSaved(parts);
      toast.success("اتحفظ السكريبت");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function approve(force: boolean) {
    if (dirty && !(await save())) return;
    setBusy("approve");
    try {
      await api(`/api/script/${card.id}/approve`, { method: "POST", json: { force } });
      toast.success("اتعتمد السكريبت وانتقل الكارت لمرحلة التصوير / المونتاج");
      setForceOpen(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "needs_force") setForceOpen(true);
      else toast.error(error instanceof Error ? error.message : "تعذّر الاعتماد");
    } finally {
      setBusy(null);
    }
  }

  async function saveExample() {
    if (dirty && !(await save())) return;
    setBusy("example");
    try {
      await api(`/api/script/${card.id}/example`, { method: "POST" });
      toast.success("اتضاف السكريبت كمثال في script-style.md");
      setExampleOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ كمثال");
    } finally {
      setBusy(null);
    }
  }

  async function startEdit() {
    if (notes.trim().length < 3) {
      toast.error("اكتب ملاحظات التعديل الأول");
      return;
    }
    if (dirty && !(await save())) return;
    try {
      const { run } = await api<{ run: Run }>(`/api/script/${card.id}/edit`, { method: "POST", json: { notes } });
      setRunId(run.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر بدء التعديل");
    }
  }

  async function pickVersion(file: string) {
    try {
      await api(`/api/script/${card.id}/version`, { method: "POST", json: { file } });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر تبديل النسخة");
    }
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-5">
        {!editable ? (
          <div role="status" className="flex items-start gap-2.5 rounded-xl border border-line-strong bg-canvas-alt px-4 py-3 text-sm">
            <Lock aria-hidden="true" className="mt-1 size-4 shrink-0" />
            <p>
              الكارت في مرحلة <strong>{STAGE_LABEL[card.stage]}</strong>، فالسكريبت للقراءة بس. لو عايز تعدّله، ارجع الكارت لمرحلة السكريبت من{" "}
              <Link href="/" className="font-semibold text-accent underline-offset-4 hover:underline">لوحة المتابعة</Link>.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {script.preTraining ? <Badge tone="accent">مسودة قبل التدريب</Badge> : null}
          {script.simulated ? <Badge tone="accent">محاكاة</Badge> : null}
          {approved ? (
            <Badge tone="success"><Check aria-hidden="true" className="size-3" /> معتمد</Badge>
          ) : (
            <Badge>في انتظار الموافقة</Badge>
          )}
          {dirty ? <Badge tone="error">تعديلات غير محفوظة</Badge> : null}
        </div>

        {SECTIONS.map(({ key, label, hint, rows }) => {
          const words = countWords(parts[key]);
          const seconds = Math.round(words / duration.rate);
          const hookWarn = key === "hook" && duration.hookTooLong;
          return (
            <Field
              key={key}
              label={label}
              htmlFor={`part-${key}`}
              hint={hint}
              aside={
                <>
                  <span dir="ltr" className="font-mono">{words}</span> كلمة • <span dir="ltr" className="font-mono">~{seconds}s</span>
                </>
              }
            >
              <textarea
                id={`part-${key}`}
                rows={rows}
                value={parts[key]}
                readOnly={!editable}
                onChange={(event) => setParts((current) => ({ ...current, [key]: event.target.value }))}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "s") {
                    event.preventDefault();
                    if (editable && dirty) void save();
                  }
                }}
                aria-describedby={hookWarn ? "hook-warning" : undefined}
                className={cn(textareaClass, "text-[1.05rem]", !editable && "bg-canvas-alt", hookWarn && "border-primary-600")}
              />
              {hookWarn ? (
                <p id="hook-warning" className="mt-1.5 flex items-center gap-1.5 text-sm text-accent">
                  <TriangleAlert aria-hidden="true" className="size-4" />
                  الـ Hook حوالي <span dir="ltr" className="font-mono">{duration.hookSeconds.toFixed(1)}s</span> وأطول من 3 ثواني.
                </p>
              ) : null}
            </Field>
          );
        })}

        {script.hasPlaceholders ? (
          <p role="status" className="flex items-start gap-2 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
            فيه معلومات ناقصة بين [ ] (الـ Agent مبيخترعش أرقام أو أسعار). كمّلها بنفسك قبل الاعتماد.
          </p>
        ) : null}

        {/* sticky action bar */}
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lift backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-4 text-accent" />
              <strong dir="ltr" className="font-mono">~{duration.seconds}s</strong>
            </span>
            <span className="text-ink-muted">
              <span dir="ltr" className="font-mono">{duration.words}</span> كلمة ÷ <span dir="ltr" className="font-mono">{duration.rate}</span> ك/ث
              {duration.rateIsAssumed ? <span className="ms-1.5 rounded bg-accent-soft px-1.5 text-xs text-accent">افتراض</span> : null}
            </span>
          </div>
          {editable ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setExampleOpen(true)} disabled={busy !== null}>
                <BookmarkPlus aria-hidden="true" className="size-4" />
                احفظ كمثال لأسلوبي
              </Button>
              <Button variant="secondary" size="sm" onClick={save} disabled={busy !== null || !dirty}>
                <Save aria-hidden="true" className="size-4" />
                حفظ
              </Button>
              <Button size="sm" onClick={() => approve(false)} disabled={busy !== null}>
                <Check aria-hidden="true" className="size-4" />
                اعتمد
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="grid gap-5" aria-label="أدوات السكريبت">
        <RunPanel runId={runId} onFinished={() => router.refresh()} onRetry={startEdit} />

        {editable ? (
          <section className="rounded-xl border border-line bg-surface p-4 shadow-card" aria-labelledby="ai-edit">
            <h2 id="ai-edit" className="flex items-center gap-2 text-base font-bold">
              <Wand2 aria-hidden="true" className="size-4 text-accent" />
              تعديل بالـ AI
            </h2>
            <p className="mt-1 text-xs text-ink-muted">هيتعمل نسخة جديدة (v2, v3…) من غير ما النسخة الحالية تتمسح.</p>
            <Field label="ملاحظاتك" htmlFor="ai-notes" className="mt-3">
              <textarea id="ai-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: اختصر الـ Hook وشيل الجملة التانية" className={textareaClass} />
            </Field>
            <Button onClick={startEdit} className="mt-3 w-full" disabled={busy !== null}>
              <Sparkles aria-hidden="true" className="size-4" />
              نفّذ التعديل
            </Button>
          </section>
        ) : null}

        <section className="rounded-xl border border-line bg-surface p-4 shadow-card" aria-labelledby="versions">
          <h2 id="versions" className="text-base font-bold">النسخ</h2>
          <ul className="mt-2 grid gap-1.5">
            {view.versions.map((version) => {
              const current = version.file === script.file;
              return (
                <li key={version.file}>
                  <button
                    type="button"
                    onClick={() => editable && !current && pickVersion(version.file)}
                    disabled={!editable || current}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-start text-sm",
                      current ? "border-primary-500 bg-accent-soft" : "border-line hover:border-line-strong disabled:opacity-70",
                    )}
                  >
                    <span>
                      <strong dir="ltr" className="font-mono">v{version.version}</strong>
                      <span className="ms-2 text-xs text-ink-muted">{formatDateTime(version.modifiedAt)}</span>
                    </span>
                    {current ? <Badge tone="accent" className="py-0">الحالية</Badge> : version.status === "approved" ? <Badge tone="success" className="py-0">معتمدة</Badge> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4 text-sm shadow-card" aria-labelledby="idea-ctx">
          <h2 id="idea-ctx" className="text-base font-bold">من أين جت الفكرة</h2>
          {card.ideaQuestion ? <p className="mt-2 text-ink-muted">«{card.ideaQuestion}»</p> : null}
          {card.ideaHook ? (
            <p className="mt-2">
              <span className="text-xs text-ink-muted">Hook مقترح من Research: </span>
              {card.ideaHook}
            </p>
          ) : null}
        </section>
      </aside>

      <Dialog
        open={forceOpen}
        onClose={() => setForceOpen(false)}
        title="فيه معلومات ناقصة"
        description="لسه في السكريبت أجزاء بين [ ] بتطلب معلومة منك."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForceOpen(false)}>ارجع أكمّل</Button>
            <Button onClick={() => approve(true)} disabled={busy !== null}>اعتمد رغم كده</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">لو اعتمدت كده، الكلام بين [ ] هيفضل زي ما هو وإنت اللي هتقوله أو تتخطاه وقت التصوير.</p>
      </Dialog>

      <Dialog
        open={exampleOpen}
        onClose={() => setExampleOpen(false)}
        title="حفظ كمثال لأسلوبك؟"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExampleOpen(false)}>إلغاء</Button>
            <Button onClick={saveExample} disabled={busy !== null}>احفظ المثال</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          هيتنسخ السكريبت بنصه تحت «أمثلة ممتازة» في <span dir="ltr" className="font-mono text-xs text-ink">script-style.md</span> ويتسجّل في Training Log. <strong className="text-ink">مش هيحوّل الأسلوب لـ «مُدرَّب»</strong>، ده قرارك إنت من صفحة التدريب.
        </p>
      </Dialog>
    </div>
  );
}

type Props = { view: ScriptView | null };

export function ScriptStudio({ view }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [runId, setRunId] = useState<string | null>(null);

  if (!view) return null;
  const { card } = view;

  async function generate() {
    try {
      const { run } = await api<{ run: Run }>(`/api/script/${card.id}/generate`, { method: "POST" });
      setRunId(run.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر بدء الكتابة");
    }
  }

  if (!view.script) {
    return (
      <div className="grid max-w-3xl gap-5">
        <section className="rounded-xl border border-line bg-surface p-6 shadow-card">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <PenLine aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">لسه مفيش سكريبت لـ «{card.title}»</h2>
              {card.ideaQuestion ? <p className="mt-1 text-sm text-ink-muted">السؤال الأصلي: «{card.ideaQuestion}»</p> : null}
              {card.ideaHook ? <p className="mt-1 text-sm">Hook مقترح: {card.ideaHook}</p> : null}
              {!view.style.trained ? (
                <p className="mt-3 text-sm text-ink-muted">أسلوبك لسه متدرّبش عليه، فالسكريبت هيتكتب <strong className="text-ink">مسودة قبل التدريب</strong> بنبرة محايدة.</p>
              ) : null}
            </div>
          </div>
          <Button onClick={generate} size="lg" className="mt-5" disabled={runId !== null}>
            <Sparkles aria-hidden="true" className="size-4" />
            اكتب سكريبت
          </Button>
        </section>
        <RunPanel runId={runId} onFinished={() => router.refresh()} onRetry={generate} />
      </div>
    );
  }

  return <Editor key={view.script.file} view={view} />;
}
