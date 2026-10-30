"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clapperboard, ImageIcon, ListChecks, Lock, Monitor, Play, RefreshCw, Sparkles, Video } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatBytes, formatClock } from "@/lib/format";
import { STAGE_LABEL } from "@/lib/stages";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toaster";
import { RunPanel } from "@/components/runs/RunPanel";
import type { Run } from "@/server/db";
import type { FilmingView } from "@/server/services/filming";
import { TimelineRuler } from "./TimelineRuler";
import { Uploader } from "./Uploader";

function Step({ index, title, done, children, aside }: { index: string; title: string; done?: boolean; children: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-labelledby={`step-${index}`} className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={`step-${index}`} className="flex items-center gap-3 text-lg font-bold">
          <span dir="ltr" className={cn("grid size-8 place-items-center rounded-full font-mono text-sm", done ? "bg-success-500/15 text-success-700" : "bg-accent-soft text-accent")}>
            {done ? <Check aria-hidden="true" className="size-4" strokeWidth={2.5} /> : index}
          </span>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function FilmingStudio({ view }: { view: FilmingView }) {
  const router = useRouter();
  const toast = useToast();
  const { card, shotlist, footage, montage } = view;
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inStage = card.stage === "filming";
  const refresh = () => router.refresh();

  async function start(path: "shotlist" | "montage") {
    try {
      const { run } = await api<{ run: Run }>(`/api/filming/${card.id}/${path}`, { method: "POST" });
      setRunId(run.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر البدء");
    }
  }

  async function approveMontage() {
    setBusy(true);
    try {
      await api(`/api/filming/${card.id}/approve-montage`, { method: "POST" });
      toast.success("اتعتمدت خطة المونتاج. تقدر تجهّز البوست.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الاعتماد");
    } finally {
      setBusy(false);
    }
  }

  if (!inStage) {
    const early = card.stage === "idea" || card.stage === "script";
    return (
      <div role="status" className="flex max-w-2xl items-start gap-3 rounded-xl border border-line-strong bg-canvas-alt px-5 py-4">
        <Lock aria-hidden="true" className="mt-1 size-5 shrink-0" />
        <div>
          <p className="font-bold">{early ? "اعتمد السكريبت الأول" : `الكارت في مرحلة ${STAGE_LABEL[card.stage]}`}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {early
              ? "التصوير والمونتاج بيبدأوا بعد اعتماد السكريبت."
              : "مرحلة التصوير خلصت. لو عايز تعدّل فيها، ارجّع الكارت من لوحة المتابعة."}
          </p>
          <Button href={early ? `/script?card=${card.id}` : "/"} variant="secondary" size="sm" className="mt-3">
            {early ? "روح للسكريبت" : "لوحة المتابعة"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <RunPanel runId={runId} onFinished={refresh} onRetry={() => void start("montage")} />

      {/* 1. shot list */}
      <Step
        index="1"
        title="Shot list"
        done={Boolean(shotlist)}
        aside={
          shotlist ? (
            <Button variant="secondary" size="sm" onClick={() => start("shotlist")}>
              <RefreshCw aria-hidden="true" className="size-4" />
              أعد التوليد
            </Button>
          ) : null
        }
      >
        {shotlist ? (
          <div className="grid gap-3">
            {shotlist.preTraining ? <div><Badge tone="accent">مسودة قبل التدريب</Badge></div> : null}
            {shotlist.rows.length > 0 ? (
              <div className="thin-scroll overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[40rem] text-sm">
                  <caption className="sr-only">قائمة اللقطات</caption>
                  <thead>
                    <tr className="bg-canvas-alt text-xs text-ink-muted">
                      {shotlist.header.map((name) => (
                        <th key={name} scope="col" className="px-3 py-2 text-start font-medium">{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shotlist.rows.map((row, index) => (
                      <tr key={index}>
                        {shotlist.header.map((_, col) => (
                          <td key={col} className={cn("px-3 py-2 align-top", col === 0 && "font-mono text-xs text-ink-muted")}>{row[col] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre className="thin-scroll max-h-72 overflow-auto rounded-lg bg-canvas-alt p-4 text-sm leading-7 whitespace-pre-wrap">{shotlist.raw}</pre>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-ink-muted">بتتولّد من السكريبت المعتمد: كل جزء منطوق ليه لقطة مقترحة ومدة تقريبية.</p>
            <Button onClick={() => start("shotlist")} disabled={!view.scriptApproved}>
              <ListChecks aria-hidden="true" className="size-4" />
              ولّد الـ Shot list
            </Button>
          </div>
        )}
      </Step>

      {/* 2. teleprompter */}
      <Step index="2" title="Teleprompter">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-ink-muted">
            السكريبت بيتحرك على شاشة داكنة، وإنت تتحكم في السرعة والحجم والانعكاس (لو بتصوّر بزجاج Teleprompter). Space للتشغيل والإيقاف.
          </p>
          <Button href={`/teleprompter/${card.id}`}>
            <Monitor aria-hidden="true" className="size-4" />
            افتح الـ Teleprompter
          </Button>
        </div>
      </Step>

      {/* 3. footage */}
      <Step index="3" title="الفيديو المتصور" done={Boolean(footage)}>
        <div className="grid gap-4">
          {footage ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-canvas-alt px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <Video aria-hidden="true" className="size-4 text-accent" />
                <span dir="ltr" className="font-mono text-xs">{footage.original}</span>
              </span>
              <span className="text-ink-muted">{formatBytes(footage.sizeBytes)}</span>
              {footage.info?.durationSeconds ? <span dir="ltr" className="font-mono text-xs">{formatClock(footage.info.durationSeconds)}</span> : null}
              {footage.info?.width ? <span dir="ltr" className="font-mono text-xs">{footage.info.width}×{footage.info.height} • {footage.info.fps ?? "?"} fps</span> : null}
            </div>
          ) : null}
          <Uploader cardId={card.id} onUploaded={() => (toast.success("اترفع الفيديو"), refresh())} onError={(message) => toast.error(message)} />
          {footage ? <p className="text-xs text-ink-muted">رفع فيديو جديد بيستبدل القديم ويمسح خطة المونتاج الحالية.</p> : null}
        </div>
      </Step>

      {/* 4. montage */}
      <Step
        index="4"
        title="خطة المونتاج"
        done={montage?.status === "approved"}
        aside={
          montage ? (
            <div className="flex flex-wrap items-center gap-2">
              {montage.preTraining ? <Badge tone="accent">مسودة قبل التدريب</Badge> : null}
              {montage.simulated ? <Badge tone="accent">محاكاة</Badge> : null}
              {montage.status === "approved" ? <Badge tone="success"><Check aria-hidden="true" className="size-3" /> معتمدة</Badge> : <Badge>في انتظار الموافقة</Badge>}
            </div>
          ) : null
        }
      >
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-ink-muted">
              الـ Montage Agent بيحلل الفيديو بـ ffprobe/ffmpeg (قطعات، سكتات، فريمات) وبيبني خطة بالـ Timestamps. مفيش Render، الخطة مكتوبة بس.
              {!view.montageStyleTrained ? " طريقتك في المونتاج لسه متدرّبش عليها، فالخطة عامة." : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => start("montage")} disabled={!footage || !view.scriptApproved}>
                <Clapperboard aria-hidden="true" className="size-4" />
                {montage ? "أعد خطة المونتاج" : "اعمل خطة المونتاج"}
              </Button>
              {montage && montage.status !== "approved" ? (
                <Button variant="secondary" onClick={approveMontage} disabled={busy}>
                  <Check aria-hidden="true" className="size-4" />
                  اعتمد الخطة
                </Button>
              ) : null}
            </div>
          </div>
          {!footage ? <p className="text-sm text-ink-muted">ارفع الفيديو في الخطوة 3 الأول.</p> : null}

          {montage ? (
            <div className="fade-in grid gap-5">
              <TimelineRuler rows={montage.parsed.timeline} total={montage.parsed.totalSeconds} />

              {montage.parsed.sourceInfo ? (
                <div className="rounded-lg bg-canvas-alt px-4 py-3 text-sm">
                  <p className="mb-0.5 text-xs font-semibold text-ink-muted">معلومات الفيديو المصدر</p>
                  <p className="whitespace-pre-line">{montage.parsed.sourceInfo}</p>
                </div>
              ) : null}

              {montage.parsed.timeline.length > 0 ? (
                <div className="thin-scroll overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[56rem] text-sm">
                    <caption className="sr-only">خطة المونتاج بالـ Timestamps</caption>
                    <thead>
                      <tr className="bg-canvas-alt text-xs text-ink-muted">
                        {montage.parsed.columns.map((name) => (
                          <th key={name} scope="col" className="px-3 py-2 text-start font-medium">{name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {montage.parsed.timeline.map((row, index) => (
                        <tr key={`${row.index}-${index}`}>
                          {[row.index, row.time, row.source, row.cut, row.text, row.effects, row.audio, row.broll, row.note].slice(0, montage.parsed.columns.length || 9).map((cell, col) => (
                            <td key={col} className={cn("px-3 py-2 align-top", col <= 1 && "font-mono text-xs")}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {montage.parsed.warnings.length > 0 ? (
                <p role="status" className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm">{montage.parsed.warnings.join(" • ")}</p>
              ) : null}

              {montage.parsed.notes ? (
                <div className="text-sm">
                  <p className="mb-0.5 text-xs font-semibold text-ink-muted">ملاحظات وفجوات</p>
                  <p className="whitespace-pre-line">{montage.parsed.notes}</p>
                </div>
              ) : null}

              {montage.frames.length > 0 ? (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                    <ImageIcon aria-hidden="true" className="size-4 text-accent" />
                    الفريمات المستخرجة ({montage.frames.length})
                  </h3>
                  <ul className="thin-scroll flex gap-2 overflow-x-auto pb-2">
                    {montage.frames.map((frame) => (
                      <li key={frame.path} className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element -- local API route, not an optimisable asset */}
                        <img src={`/api/files/frame?path=${encodeURIComponent(frame.path)}`} alt={`فريم ${frame.name}`} loading="lazy" className="h-36 w-auto rounded-lg border border-line bg-canvas-alt" />
                        <p dir="ltr" className="mt-1 text-center font-mono text-[0.7rem] text-ink-muted">{frame.name}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {montage.status === "approved" ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3">
                  <p className="text-sm font-semibold">الخطة معتمدة. الخطوة الجاية: كابشن وهاشتاجات ووقت النشر.</p>
                  <Button href={`/posting?card=${card.id}`} size="sm">
                    <Play aria-hidden="true" className="size-4 ltr:rotate-0" />
                    روح للنشر
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Step>

      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <Sparkles aria-hidden="true" className="size-3.5" />
        الفيديو الأصلي للقراءة بس: الـ Agent مبيعدّلوش ولا بيمسحه.{" "}
        <Link href={`/script?card=${card.id}`} className="text-accent underline-offset-4 hover:underline">راجع السكريبت</Link>
      </p>
    </div>
  );
}
