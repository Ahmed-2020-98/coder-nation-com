"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Info, Lock, Save, Send, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime, fromLocalInputValue, toLocalInputValue } from "@/lib/format";
import { STAGE_LABEL } from "@/lib/stages";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, inputClass, textareaClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toaster";
import { RunPanel } from "@/components/runs/RunPanel";
import { TagInput } from "@/components/research/TagInput";
import type { Run } from "@/server/db";
import type { CalendarItem, PostingView } from "@/server/services/posting";
import { Calendar } from "./Calendar";

type Props = { view: PostingView; montageApproved: boolean; calendar: { scheduled: CalendarItem[]; unscheduled: CalendarItem[] } };

function PostEditor({ view }: { view: PostingView }) {
  const router = useRouter();
  const toast = useToast();
  const { card } = view;
  const post = view.post!;

  const initial = { caption: post.parts.caption, keywordTags: post.parts.keywordTags, suggestedTags: post.parts.suggestedTags, timing: post.parts.timing };
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [url, setUrl] = useState("");

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const editable = post.editable;

  async function save(): Promise<boolean> {
    setBusy(true);
    try {
      await api(`/api/posting/${card.id}`, { method: "PUT", json: form });
      setSaved(form);
      toast.success("اتحفظ البوست");
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function markReady() {
    if (dirty && !(await save())) return;
    setBusy(true);
    try {
      await api(`/api/posting/${card.id}/ready`, { method: "POST" });
      toast.success("الكارت جاهز للنشر. (مفيش نشر فعلي: ده تعليم بس)");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر التعليم");
    } finally {
      setBusy(false);
    }
  }

  async function markPublished() {
    setBusy(true);
    try {
      await api(`/api/posting/${card.id}/published`, { method: "POST", json: { url: url.trim() || null } });
      toast.success("اتسجّل إنك نشرته");
      setPublishOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر التسجيل");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {post.preTraining ? <Badge tone="accent">مسودة قبل التدريب</Badge> : null}
        {post.simulated ? <Badge tone="accent">محاكاة</Badge> : null}
        {card.stage === "ready" || card.stage === "published" ? <Badge tone="success"><Check aria-hidden="true" className="size-3" /> {STAGE_LABEL[card.stage]}</Badge> : <Badge>في انتظار الموافقة</Badge>}
        {dirty ? <Badge tone="error">تعديلات غير محفوظة</Badge> : null}
      </div>

      <Field label="الكابشن" htmlFor="caption" aside={<span dir="ltr" className="font-mono">{form.caption.length} حرف</span>}>
        <textarea id="caption" rows={5} value={form.caption} readOnly={!editable} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} className={textareaClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <TagInput label="هاشتاجات من الكلمات المفتاحية" value={form.keywordTags} onChange={(keywordTags) => editable && setForm((f) => ({ ...f, keywordTags }))} hint="مرتبطة بـ keywords.md اللي إنت كتبتها." />
        <TagInput label="هاشتاجات مقترحة (غير موثّقة)" value={form.suggestedTags} onChange={(suggestedTags) => editable && setForm((f) => ({ ...f, suggestedTags }))} hint="اقتراح من الـ Agent: مش ترند مؤكد." />
      </div>

      <Field label="وقت النشر المقترح وأساسه" htmlFor="timing" hint="من غير analytics بيتعلّم «تقدير عام». اكتب موعدك الفعلي في الجدولة على الجنب.">
        <textarea id="timing" rows={2} value={form.timing} readOnly={!editable} onChange={(e) => setForm((f) => ({ ...f, timing: e.target.value }))} className={textareaClass} />
      </Field>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lift backdrop-blur">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Info aria-hidden="true" className="size-4 shrink-0 text-accent" />
          مفيش نشر فعلي من هنا: «جاهز للنشر» بيعلّم الكارت بس.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <Button variant="secondary" size="sm" onClick={save} disabled={busy || !dirty}>
              <Save aria-hidden="true" className="size-4" />
              حفظ
            </Button>
          ) : null}
          {card.stage === "filming" ? (
            <Button size="sm" onClick={markReady} disabled={busy}>
              <Check aria-hidden="true" className="size-4" />
              جاهز للنشر
            </Button>
          ) : null}
          {card.stage === "ready" ? (
            <Button size="sm" onClick={() => setPublishOpen(true)} disabled={busy}>
              <Send aria-hidden="true" className="size-4" />
              نشرته (يدويًا)
            </Button>
          ) : null}
        </div>
      </div>

      {card.stage === "published" ? (
        <p className="rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3 text-sm">
          اتنشر {card.publishedAt ? formatDateTime(card.publishedAt) : ""}{" "}
          {card.publishedUrl ? <a href={card.publishedUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline-offset-4 hover:underline">فتح الرابط</a> : null}
        </p>
      ) : null}

      <Dialog
        open={publishOpen}
        onClose={() => !busy && setPublishOpen(false)}
        title="سجّل إنك نشرت الفيديو"
        description="النشر بيتم بإيدك على TikTok. ده بس بيحط الكارت في «منشور»."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)} disabled={busy}>إلغاء</Button>
            <Button onClick={markPublished} disabled={busy}>سجّل</Button>
          </>
        }
      >
        <Field label="رابط الفيديو (اختياري)" htmlFor="publish-url">
          <input id="publish-url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tiktok.com/…" className={inputClass} inputMode="url" />
        </Field>
      </Dialog>
    </div>
  );
}

export function PostingStudio({ view, montageApproved, calendar }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { card } = view;
  const [runId, setRunId] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState(card.finalVideoPath ?? "");
  const [schedule, setSchedule] = useState(toLocalInputValue(card.scheduledAt));
  const [savingSchedule, setSavingSchedule] = useState(false);

  async function generate() {
    try {
      const { run } = await api<{ run: Run }>(`/api/posting/${card.id}/generate`, { method: "POST", json: { finalVideoPath: videoPath.trim() || null } });
      setRunId(run.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر بدء التجهيز");
    }
  }

  async function saveSchedule(value: string) {
    setSavingSchedule(true);
    try {
      await api(`/api/posting/${card.id}/schedule`, { method: "POST", json: { scheduledAt: fromLocalInputValue(value) } });
      setSchedule(value);
      toast.success(value ? "اتحفظ الموعد" : "اتشال الموعد");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر حفظ الموعد");
    } finally {
      setSavingSchedule(false);
    }
  }

  function pickDay(day: Date) {
    const base = schedule ? new Date(schedule) : null;
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base ? base.getHours() : 20, base ? base.getMinutes() : 0);
    void saveSchedule(toLocalInputValue(next.toISOString()));
  }

  const early = card.stage === "idea" || card.stage === "script";
  const needsMontage = card.stage === "filming" && !montageApproved;
  const generatedHere = card.stage === "filming" && montageApproved;

  const items = [...calendar.scheduled, ...calendar.unscheduled.filter((i) => i.id === card.id)];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="grid gap-5">
        <RunPanel runId={runId} onFinished={() => router.refresh()} onRetry={generate} />

        {early || needsMontage ? (
          <div role="status" className="flex max-w-2xl items-start gap-3 rounded-xl border border-line-strong bg-canvas-alt px-5 py-4">
            <Lock aria-hidden="true" className="mt-1 size-5 shrink-0" />
            <div>
              <p className="font-bold">{early ? "الكارت لسه في مرحلة مبكرة" : "اعتمد خطة المونتاج الأول"}</p>
              <p className="mt-1 text-sm text-ink-muted">تجهيز البوست بيجي بعد اعتماد السكريبت وخطة المونتاج.</p>
              <Button href={early ? `/script?card=${card.id}` : `/filming?card=${card.id}`} variant="secondary" size="sm" className="mt-3">
                {early ? "روح للسكريبت" : "روح للمونتاج"}
              </Button>
            </div>
          </div>
        ) : null}

        {generatedHere || (!view.post && !early && !needsMontage) ? (
          <section className="rounded-xl border border-line bg-surface p-5 shadow-card" aria-labelledby="gen-title">
            <h2 id="gen-title" className="text-lg font-bold">{view.post ? "أعد تجهيز البوست" : "جهّز البوست"}</h2>
            <p className="mt-1 text-sm text-ink-muted">كابشن وهاشتاجات وتوقيت مقترح، مبنيين على السكريبت وخطة المونتاج المعتمدين.</p>
            {!view.scriptTrained ? <p className="mt-2 text-sm text-ink-muted">أسلوبك في الكتابة لسه متدرّبش عليه، فالكابشن <strong className="text-ink">مسودة قبل التدريب</strong>.</p> : null}
            <Field label="مسار الفيديو النهائي (اختياري)" htmlFor="video-path" hint="بيتسجّل في الملف بس. الـ Posting Agent مبيشوفش الفيديو." className="mt-4">
              <input id="video-path" dir="ltr" value={videoPath} onChange={(e) => setVideoPath(e.target.value)} placeholder="/Users/you/Videos/final.mp4" className={inputClass} />
            </Field>
            <Button onClick={generate} className="mt-4" disabled={runId !== null || !montageApproved}>
              <Sparkles aria-hidden="true" className="size-4" />
              {view.post ? "أعد التجهيز" : "جهّز البوست"}
            </Button>
          </section>
        ) : null}

        {view.post ? <PostEditor key={view.post.file} view={view} /> : null}

        {!view.post && card.stage === "ready" ? <p className="text-sm text-ink-muted">لا يوجد ملف بوست لهذا الكارت.</p> : null}
      </div>

      <aside className="grid gap-5" aria-label="الجدولة">
        <section className="rounded-xl border border-line bg-surface p-4 shadow-card" aria-labelledby="schedule-title">
          <h2 id="schedule-title" className="text-base font-bold">موعد النشر</h2>
          <Field label="التاريخ والوقت" htmlFor="schedule" className="mt-3" hint={card.stage === "published" ? "الفيديو اتنشر." : "اختار يوم من التقويم أو اكتب الموعد."}>
            <input id="schedule" type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} disabled={card.stage === "published" || early} className={inputClass} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => saveSchedule(schedule)} disabled={savingSchedule || card.stage === "published" || early || schedule === toLocalInputValue(card.scheduledAt)}>
              احفظ الموعد
            </Button>
            {card.scheduledAt ? (
              <Button size="sm" variant="secondary" onClick={() => saveSchedule("")} disabled={savingSchedule || card.stage === "published"}>
                <Trash2 aria-hidden="true" className="size-4" />
                إزالة
              </Button>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4 shadow-card" aria-labelledby="calendar-title">
          <h2 id="calendar-title" className="mb-3 text-base font-bold">تقويم النشر</h2>
          <Calendar items={items} activeId={card.id} onPick={card.stage === "published" || early ? undefined : pickDay} initialMonth={card.scheduledAt} />
          {calendar.scheduled.length > 0 ? (
            <ul className="mt-3 grid gap-1.5 border-t border-line pt-3 text-sm">
              {calendar.scheduled.slice(0, 6).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <Link href={`/posting?card=${item.id}`} className="min-w-0 truncate font-medium hover:text-accent">{item.title}</Link>
                  <span className="shrink-0 text-xs text-ink-muted">{formatDateTime(item.scheduledAt)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
