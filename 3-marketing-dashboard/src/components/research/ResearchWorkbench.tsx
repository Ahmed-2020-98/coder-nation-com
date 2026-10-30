"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, FileSpreadsheet, Files, Play, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/Status";
import { Field, inputClass, textareaClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toaster";
import { RunPanel } from "@/components/runs/RunPanel";
import type { Card, Run } from "@/server/db";
import type { CommentFile, IdeaBatch, IdeasView, UploadPreview } from "@/server/services/research";
import { IdeasResult } from "./IdeasResult";
import { TagInput } from "./TagInput";

type Props = {
  commentFiles: CommentFile[];
  batches: IdeaBatch[];
  initialBatchFile: string | null;
  initialView: IdeasView | null;
  keywords: string[];
  trends: string[];
  cards: Pick<Card, "id" | "slug" | "ideaFile" | "ideaNo">[];
};

type Tab = "paste" | "upload" | "saved";

const TABS: { id: Tab; label: string; icon: typeof ClipboardPaste }[] = [
  { id: "paste", label: "لصق", icon: ClipboardPaste },
  { id: "upload", label: "رفع ملف", icon: FileSpreadsheet },
  { id: "saved", label: "محفوظة", icon: Files },
];

export function ResearchWorkbench(props: Props) {
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>(props.commentFiles.length ? "saved" : "paste");
  const [files, setFiles] = useState(props.commentFiles);
  const [selected, setSelected] = useState<string | null>(props.commentFiles[0]?.file ?? null);

  const [pasted, setPasted] = useState("");
  const [pastedError, setPastedError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [textColumn, setTextColumn] = useState(0);
  const [likesColumn, setLikesColumn] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [keywords, setKeywords] = useState(props.keywords);
  const [trends, setTrends] = useState(props.trends.join("\n"));

  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [batches, setBatches] = useState(props.batches);
  const [batchFile, setBatchFile] = useState(props.initialBatchFile);
  const [view, setView] = useState(props.initialView);
  const [viewState, setViewState] = useState<"idle" | "loading" | "error">("idle");
  const [viewError, setViewError] = useState<string | null>(null);

  const pastedCount = pasted.split(/\r?\n/).filter((line) => line.trim()).length;

  async function refreshFiles(select?: string) {
    const data = await api<{ files: CommentFile[] }>("/api/research/comments");
    setFiles(data.files);
    if (select) setSelected(select);
  }

  async function savePasted() {
    setPastedError(null);
    setSaving(true);
    try {
      const saved = await api<{ file: string; count: number }>("/api/research/comments", { method: "POST", json: { text: pasted } });
      await refreshFiles(saved.file);
      toast.success(`اتحفظت ${saved.count} كومنت كدفعة جديدة`);
      setPasted("");
      setTab("saved");
    } catch (error) {
      setPastedError(error instanceof Error ? error.message : "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError(null);
    setPreview(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const data = await api<UploadPreview>("/api/research/upload", { method: "POST", body: form });
      setPreview(data);
      setTextColumn(data.suggestedText);
      setLikesColumn(data.suggestedLikes);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "تعذّر قراءة الملف");
    } finally {
      setSaving(false);
    }
  }

  async function confirmUpload() {
    if (!preview) return;
    setSaving(true);
    setUploadError(null);
    try {
      const saved = await api<{ file: string; count: number }>("/api/research/upload/confirm", {
        method: "POST",
        json: { token: preview.token, textColumn, likesColumn },
      });
      await refreshFiles(saved.file);
      toast.success(`اتحفظت ${saved.count} كومنت من «${preview.filename}»`);
      setPreview(null);
      setTab("saved");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function analyze() {
    if (!selected) return;
    setStarting(true);
    try {
      await api("/api/research/keywords", {
        method: "PUT",
        json: { keywords, trends: trends.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) },
      });
      const { run } = await api<{ run: Run }>("/api/research/analyze", { method: "POST", json: { commentsFile: selected } });
      setRunId(run.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر بدء التحليل");
    } finally {
      setStarting(false);
    }
  }

  async function selectBatch(file: string) {
    setBatchFile(file);
    setViewState("loading");
    setViewError(null);
    try {
      setView(await api<IdeasView>(`/api/research/ideas?file=${encodeURIComponent(file)}`));
      setViewState("idle");
    } catch (error) {
      setViewState("error");
      setViewError(error instanceof Error ? error.message : "تعذّر قراءة النتيجة");
    }
  }

  async function onRunFinished(run: Run) {
    if (run.status !== "succeeded") return;
    toast.success("خلص التحليل");
    try {
      const data = await api<{ batches: IdeaBatch[] }>("/api/research/ideas");
      setBatches(data.batches);
      await refreshFiles();
      if (run.outputFile) await selectBatch(run.outputFile);
      router.refresh();
    } catch {
      /* the result is still on disk; the user can pick it from the list */
    }
  }

  const selectedFile = files.find((file) => file.file === selected);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* ---------- inputs (stays in view while the results scroll) ---------- */}
      <div className="thin-scroll grid gap-5 xl:sticky xl:top-5 xl:max-h-[calc(100svh-2.5rem)] xl:overflow-y-auto xl:pe-1">
        <section aria-labelledby="inputs-title" className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 id="inputs-title" className="text-lg font-bold">
            الكومنتات
          </h2>
          <div role="tablist" aria-label="طريقة الإدخال" className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-canvas-alt p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-colors",
                  tab === id ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </button>
            ))}
          </div>

          {tab === "paste" ? (
            <div role="tabpanel" id="panel-paste" aria-labelledby="tab-paste" className="mt-4 grid gap-3">
              <Field label="الصق الكومنتات" htmlFor="paste" hint="كومنت في كل سطر. لو عندك عدد لايكات حطه في آخر السطر بعد علامة |" error={pastedError} aside={`${pastedCount} كومنت`}>
                <textarea id="paste" rows={9} value={pasted} onChange={(e) => setPasted(e.target.value)} className={textareaClass} placeholder={"كام سعر عمل موقع؟ | 42\nبتعملوا تطبيقات Flutter؟"} />
              </Field>
              <Button onClick={savePasted} disabled={saving || pastedCount === 0}>
                احفظ كدفعة
              </Button>
            </div>
          ) : null}

          {tab === "upload" ? (
            <div role="tabpanel" id="panel-upload" aria-labelledby="tab-upload" className="mt-4 grid gap-3">
              <input ref={fileInput} id="comments-file" type="file" accept=".txt,.csv,.xlsx" onChange={onFileChosen} className="sr-only" />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={saving}
                className="grid min-h-28 place-items-center rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm hover:border-accent hover:bg-accent-soft"
              >
                <span>
                  <FileSpreadsheet aria-hidden="true" className="mx-auto mb-2 size-6 text-accent" />
                  <strong className="block">اختار ملف TXT أو CSV أو XLSX</strong>
                  <span className="text-ink-muted">وبعدين تحدد عمود الكومنتات وعمود اللايكات</span>
                </span>
              </button>
              {saving && !preview ? <Skeleton className="h-10" /> : null}
              {uploadError ? (
                <p role="alert" className="rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-700">
                  {uploadError}
                </p>
              ) : null}
              {preview ? (
                <div className="fade-in grid gap-3 rounded-xl border border-line p-3.5">
                  <p className="text-sm">
                    <strong>{preview.filename}</strong> • <span dir="ltr" className="font-mono">{preview.rowCount}</span> صف
                  </p>
                  {preview.encodingSuspect ? (
                    <p role="status" className="flex gap-2 rounded-lg bg-accent-soft px-3 py-2 text-xs">
                      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                      الملف شكله مش UTF-8 (فيه رموز مكسورة). احفظه من Excel بترميز UTF-8 لو العربي ظهر غلط.
                    </p>
                  ) : null}
                  {preview.truncated ? <p className="text-xs text-ink-muted">اتقرأ أول 20,000 صف بس.</p> : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="عمود الكومنتات" htmlFor="col-text">
                      <select id="col-text" value={textColumn} onChange={(e) => setTextColumn(Number(e.target.value))} className={inputClass}>
                        {preview.columns.map((name, index) => (
                          <option key={index} value={index}>{name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="عمود اللايكات (اختياري)" htmlFor="col-likes">
                      <select id="col-likes" value={likesColumn ?? ""} onChange={(e) => setLikesColumn(e.target.value === "" ? null : Number(e.target.value))} className={inputClass}>
                        <option value="">بدون</option>
                        {preview.columns.map((name, index) => (
                          <option key={index} value={index}>{name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="thin-scroll overflow-x-auto rounded-lg border border-line">
                    <table className="w-full min-w-[20rem] text-xs">
                      <caption className="sr-only">معاينة أول الصفوف</caption>
                      <thead>
                        <tr className="bg-canvas-alt">
                          {preview.columns.map((name, index) => (
                            <th key={index} scope="col" className={cn("px-2.5 py-1.5 text-start font-semibold", index === textColumn && "text-accent")}>{name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {preview.sample.map((row, i) => (
                          <tr key={i}>
                            {preview.columns.map((_, index) => (
                              <td key={index} className="max-w-48 truncate px-2.5 py-1.5">{row[index] ?? ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button onClick={confirmUpload} disabled={saving}>
                    استخدم الأعمدة دي
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "saved" ? (
            <div role="tabpanel" id="panel-saved" aria-labelledby="tab-saved" className="mt-4">
              {files.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">لسه مفيش دفعات. الصق كومنتات أو ارفع ملف.</p>
              ) : (
                <fieldset className="grid gap-2">
                  <legend className="sr-only">اختار الدفعة اللي هتتحلل</legend>
                  {files.map((file) => (
                    <label key={file.file} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors", selected === file.file ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}>
                      <input type="radio" name="batch" checked={selected === file.file} onChange={() => setSelected(file.file)} className="size-4 accent-primary-600" />
                      <span className="min-w-0 flex-1">
                        <span dir="ltr" className="block truncate font-mono text-xs">{file.batch}</span>
                        <span className="text-xs text-ink-muted">{file.count} كومنت • {formatDateTime(file.modifiedAt)}</span>
                      </span>
                      {file.analyzed ? <Badge tone="success">اتحللت</Badge> : null}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
          ) : null}
        </section>

        <section aria-labelledby="kw-title" className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 id="kw-title" className="text-lg font-bold">
            الكلمات المفتاحية والترندات
          </h2>
          <TagInput label="الكلمات المفتاحية" value={keywords} onChange={setKeywords} hint="بيقراها الـ Research Agent، وبيستخدمها الـ Posting للهاشتاجات." />
          <Field label="ترندات لاحظتها" htmlFor="trends" hint="ترند في كل سطر (الوصف + المصدر أو التاريخ لو عندك)">
            <textarea id="trends" rows={3} value={trends} onChange={(e) => setTrends(e.target.value)} className={textareaClass} />
          </Field>
          <div className="border-t border-line pt-4">
            <p className="mb-3 text-sm text-ink-muted">
              {selectedFile ? (
                <>
                  هيتحلل: <span dir="ltr" className="font-mono text-xs text-ink">{selectedFile.batch}</span> ({selectedFile.count} كومنت)
                </>
              ) : (
                "اختار دفعة كومنتات الأول."
              )}
            </p>
            <Button onClick={analyze} disabled={!selected || starting} className="w-full" size="lg">
              <Play aria-hidden="true" className="size-4" />
              حلّل
            </Button>
          </div>
        </section>
      </div>

      {/* ---------- results ---------- */}
      <div className="grid min-w-0 gap-5">
        <RunPanel runId={runId} onFinished={onRunFinished} onRetry={analyze} />

        {batches.length > 0 ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-bold">النتائج</h2>
            <div className="w-full sm:w-80">
              <label htmlFor="batch-select" className="sr-only">اختار نتيجة</label>
              <select id="batch-select" value={batchFile ?? ""} onChange={(e) => e.target.value && selectBatch(e.target.value)} className={inputClass}>
                {batchFile === null ? <option value="">اختار نتيجة…</option> : null}
                {batches.map((batch) => (
                  <option key={batch.file} value={batch.file}>
                    {batch.batch}{batch.total ? ` (${batch.total})` : ""}{batch.simulated ? " • محاكاة" : ""}{batch.selectedIdea ? ` • فكرة #${batch.selectedIdea} اتحوّلت` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {viewState === "loading" ? (
          <div className="grid gap-3" aria-busy="true">
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : viewState === "error" ? (
          <div role="alert" className="rounded-xl border border-error-500/40 bg-error-500/10 p-4">
            <p className="font-semibold text-error-700">مقدرتش أقرأ النتيجة</p>
            <p className="mt-1 text-sm">{viewError}</p>
            {batchFile ? (
              <Button size="sm" className="mt-3" onClick={() => selectBatch(batchFile)}>
                إعادة المحاولة
              </Button>
            ) : null}
          </div>
        ) : view ? (
          <IdeasResult key={view.file} view={view} cards={props.cards} />
        ) : (
          <EmptyState icon={<Play aria-hidden="true" className="size-5" />} title="لسه مفيش نتايج">
            الصق كومنتات TikTok أو ارفع ملف، وبعدين اضغط «حلّل». النتيجة هتظهر هنا: أهم الأسئلة وعدد تكرارها وأفكار فيديو مقترحة.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
