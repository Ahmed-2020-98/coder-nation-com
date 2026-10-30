"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Quote, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { isValidSlug } from "@/lib/stages";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toaster";
import type { Card } from "@/server/db";
import type { Idea } from "@/server/parse/ideas";
import type { IdeasView } from "@/server/services/research";
import { ClusterChart } from "./ClusterChart";

type LinkedCard = Pick<Card, "id" | "slug" | "ideaFile" | "ideaNo">;

function suggestSlug(ideaNo: number): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `idea-${ideaNo}-${stamp}`;
}

/** The parsed result of one analysis: the chart, the five ideas (with "convert to idea"), and every cluster. */
export function IdeasResult({ view, cards }: { view: IdeasView; cards: LinkedCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const { parsed } = view;
  const [target, setTarget] = useState<Idea | null>(null);
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const examplesByCluster = useMemo(() => {
    const map = new Map<string, { id: string; text: string; likes: number | null }[]>();
    for (const comment of parsed.mapping) {
      const list = map.get(comment.cluster) ?? [];
      if (list.length < 3) list.push(comment);
      map.set(comment.cluster, list);
    }
    return map;
  }, [parsed.mapping]);

  const clusterOfIdea = useMemo(() => {
    const byComment = new Map(parsed.mapping.map((comment) => [comment.id, comment.cluster]));
    return (idea: Idea) => (idea.questionRef ? byComment.get(idea.questionRef) ?? null : null);
  }, [parsed.mapping]);

  const highlight = useMemo(() => new Set(parsed.ideas.map(clusterOfIdea).filter((id): id is string => Boolean(id))), [parsed.ideas, clusterOfIdea]);
  const cardFor = (idea: Idea) => cards.find((card) => card.ideaFile === view.file && card.ideaNo === idea.no);
  const readable = parsed.ideas.length > 0;

  function open(idea: Idea) {
    setTarget(idea);
    setSlug(suggestSlug(idea.no));
    setSlugError(null);
  }

  async function convert() {
    if (!target) return;
    if (!isValidSlug(slug)) {
      setSlugError("حروف إنجليزي صغيرة وأرقام مفصولة بـ - (من 3 لـ 60 حرف). مثال: website-cost");
      return;
    }
    setSaving(true);
    try {
      await api("/api/cards", { method: "POST", json: { ideasFile: view.file, ideaNo: target.no, slug } });
      toast.success(`اتحوّلت الفكرة «${target.title}» لكارت في الـ Pipeline`);
      setTarget(null);
      router.refresh();
    } catch (error) {
      setSlugError(error instanceof Error ? error.message : "تعذّر إنشاء الكارت");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-in grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {parsed.summary.total !== null ? (
          <Badge>
            <span dir="ltr" className="font-mono">{parsed.summary.total}</span> كومنت
          </Badge>
        ) : null}
        {parsed.sumCheck.ok === true ? (
          <Badge tone="success">
            <Check aria-hidden="true" className="size-3" /> مجموع التصنيف مطابق
          </Badge>
        ) : parsed.sumCheck.ok === false ? (
          <Badge tone="error">
            <TriangleAlert aria-hidden="true" className="size-3" /> مجموع التصنيف مش مطابق
          </Badge>
        ) : null}
        {view.preTraining ? <Badge tone="accent">مسودة قبل التدريب</Badge> : null}
        {view.simulated ? <Badge tone="accent">محاكاة</Badge> : null}
      </div>

      {parsed.warnings.length > 0 ? (
        <div role="status" className="rounded-xl border border-primary-500/40 bg-accent-soft p-4 text-sm">
          <p className="font-semibold">ملاحظات على الملف</p>
          <ul className="mt-1 list-disc ps-5 text-ink-muted">
            {parsed.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {parsed.clusters.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
          <ClusterChart clusters={parsed.clusters.filter((cluster) => !/غير مرتبط/.test(cluster.topic))} highlight={highlight} total={parsed.summary.total} />
        </div>
      ) : null}

      {readable ? (
        <section aria-labelledby="top-ideas">
          <h3 id="top-ideas" className="mb-3 text-lg font-bold">
            أهم الأفكار
          </h3>
          <ol className="grid gap-4">
            {parsed.ideas.map((idea) => {
              const clusterId = clusterOfIdea(idea);
              const examples = clusterId ? examplesByCluster.get(clusterId) ?? [] : [];
              const card = cardFor(idea);
              return (
                <li key={idea.no} className={cn("rounded-xl border bg-surface p-5 shadow-card", card ? "border-success-500/50" : "border-line")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p dir="ltr" className="font-mono text-xs text-accent">
                        #{idea.no}
                      </p>
                      <h4 className="text-lg leading-7 font-bold">{idea.title}</h4>
                    </div>
                    {card ? (
                      <Button href={`/script?card=${card.id}`} variant="secondary" size="sm">
                        <Check aria-hidden="true" className="size-4 text-success-700" />
                        اتحوّلت • افتح
                        <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
                      </Button>
                    ) : (
                      <Button onClick={() => open(idea)} size="sm">
                        حوّل لفكرة
                      </Button>
                    )}
                  </div>

                  {idea.question ? (
                    <blockquote className="mt-3 flex gap-2.5 rounded-lg bg-canvas-alt px-3.5 py-2.5 text-sm">
                      <Quote aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent" />
                      <p>
                        {idea.question}
                        {idea.questionRef ? (
                          <span dir="ltr" className="ms-2 font-mono text-xs text-ink-muted">
                            {idea.questionRef}
                          </span>
                        ) : null}
                      </p>
                    </blockquote>
                  ) : null}

                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-ink-muted">التكرار</dt>
                      <dd className="font-semibold">
                        <span dir="ltr" className="font-mono">{idea.count ?? "—"}</span> كومنت
                        {idea.percent !== null ? <span dir="ltr" className="ms-1.5 font-mono text-xs text-ink-muted">({idea.percent}%)</span> : null}
                        {idea.likes !== null ? <span className="ms-2 text-xs text-ink-muted">لايكات: <span dir="ltr" className="font-mono">{idea.likes}</span></span> : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">مناسبة الخدمة</dt>
                      <dd>{idea.fit || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-muted">الترند</dt>
                      <dd>{idea.trend || "—"}</dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-2 text-xs text-ink-muted">
                        Hook مقترح {idea.hookIsDraft ? <Badge tone="accent" className="py-0">مسودة قبل التدريب</Badge> : null}
                      </dt>
                      <dd className="font-medium">{idea.hook || "—"}</dd>
                    </div>
                  </dl>

                  {examples.length > 0 ? (
                    <details className="group mt-3 border-t border-line pt-2.5">
                      <summary className="flex min-h-9 w-fit items-center gap-1.5 text-sm font-semibold text-accent">
                        <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
                        أمثلة من الكومنتات ({examples.length})
                      </summary>
                      <ul className="mt-2 grid gap-1.5 text-sm text-ink-muted">
                        {examples.map((comment) => (
                          <li key={comment.id} className="flex gap-2">
                            <span dir="ltr" className="font-mono text-xs">{comment.id}</span>
                            <span>
                              {comment.text}
                              {comment.likes ? <span dir="ltr" className="ms-2 font-mono text-xs">♥ {comment.likes}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <section aria-labelledby="raw-title" className="rounded-xl border border-line bg-surface p-5">
          <h3 id="raw-title" className="font-bold">الملف كما كتبه الـ Agent</h3>
          <p className="mt-1 text-sm text-ink-muted">مقدرتش أقرأ الأفكار بشكل مرتب، فهعرض الملف الخام لحد ما تراجعه.</p>
          <pre className="thin-scroll mt-3 max-h-96 overflow-auto rounded-lg bg-canvas-alt p-4 text-sm leading-7 whitespace-pre-wrap">{view.raw}</pre>
        </section>
      )}

      {parsed.clusters.length > 0 ? (
        <details className="group rounded-xl border border-line bg-surface">
          <summary className="flex min-h-12 items-center justify-between gap-2 px-5 text-base font-bold">
            كل المواضيع ({parsed.clusters.length})
            <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="thin-scroll overflow-x-auto border-t border-line">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">كل المواضيع المتجمعة</caption>
              <thead>
                <tr className="text-xs text-ink-muted">
                  <th scope="col" className="px-5 py-2 text-start font-medium">الموضوع</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">العدد</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">%</th>
                  <th scope="col" className="px-5 py-2 text-start font-medium">أمثلة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {parsed.clusters.map((cluster) => (
                  <tr key={cluster.id}>
                    <td className="px-5 py-2.5 font-medium">
                      {cluster.topic}
                      <span dir="ltr" className="ms-2 font-mono text-xs text-ink-muted">{cluster.id}</span>
                    </td>
                    <td className="px-3 py-2.5"><span dir="ltr" className="font-mono">{cluster.count}</span></td>
                    <td className="px-3 py-2.5"><span dir="ltr" className="font-mono text-ink-muted">{cluster.percent ?? "—"}</span></td>
                    <td className="px-5 py-2.5 text-ink-muted">
                      {(examplesByCluster.get(cluster.id) ?? []).slice(0, 2).map((c) => c.text).join(" • ") || cluster.examples || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <Dialog
        open={target !== null}
        onClose={() => !saving && setTarget(null)}
        title="تحويل لفكرة"
        description="هتتسجّل كاعتماد لمرحلة Research، وهينشأ كارت في أول عمود."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={saving}>إلغاء</Button>
            <Button onClick={convert} disabled={saving}>إنشاء الكارت</Button>
          </>
        }
      >
        {target ? (
          <div className="grid gap-4">
            <p className="rounded-lg bg-canvas-alt px-3.5 py-2.5 text-sm font-semibold">{target.title}</p>
            <Field label="الـ slug (اسم الفيديو بالإنجليزي)" htmlFor="idea-slug" hint="بيتكرر في أسماء كل ملفات الفيديو ده، فاختاره قصير وواضح." error={slugError}>
              <input
                id="idea-slug"
                dir="ltr"
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                aria-invalid={Boolean(slugError)}
                aria-describedby={slugError ? "idea-slug-error" : undefined}
                className={cn(inputClass, "font-mono", slugError && "border-error-500")}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

