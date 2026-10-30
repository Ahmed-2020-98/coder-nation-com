import { cn } from "@/lib/cn";
import type { Cluster } from "@/server/parse/ideas";

type Props = {
  clusters: Cluster[];
  /** Cluster ids that became one of the top ideas: drawn in the brand orange, the rest in a quiet navy tint. */
  highlight: Set<string>;
  total: number | null;
};

/**
 * Horizontal bars, sorted high to low, with the number and percentage written on every row: the value is never
 * encoded by colour alone, and a screen reader gets a plain ranked list. No chart library needed for ≤ 15 bars.
 */
export function ClusterChart({ clusters, highlight, total }: Props) {
  const sorted = [...clusters].sort((a, b) => b.count - a.count).slice(0, 12);
  const max = Math.max(1, ...sorted.map((cluster) => cluster.count));
  if (sorted.length === 0) return null;

  return (
    <figure>
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base font-bold">أكتر الأسئلة تكرارًا</span>
        <span className="text-xs text-ink-muted">
          <span aria-hidden="true" className="me-1 inline-block size-2.5 rounded-sm bg-primary-500 align-middle" />
          الأفكار الخمس المقترحة
        </span>
      </figcaption>
      <ol className="grid gap-2.5" aria-label="ترتيب المواضيع حسب التكرار">
        {sorted.map((cluster, index) => {
          const share = cluster.percent ?? (total ? Math.round((cluster.count / total) * 1000) / 10 : null);
          const featured = highlight.has(cluster.id);
          return (
            <li key={cluster.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 sm:grid-cols-[1.5rem_minmax(0,14rem)_minmax(0,1fr)_5.5rem]">
              <span dir="ltr" className="font-mono text-xs text-ink-muted">
                {index + 1}
              </span>
              <span className={cn("truncate text-sm", featured ? "font-semibold" : "text-ink-muted")} title={cluster.topic}>
                {cluster.topic}
              </span>
              <div className="col-span-2 h-3 overflow-hidden rounded-full bg-canvas-alt sm:col-span-1" aria-hidden="true">
                <div className={cn("h-full rounded-full", featured ? "bg-primary-500" : "bg-secondary-400")} style={{ width: `${Math.max(3, (cluster.count / max) * 100)}%` }} />
              </div>
              <span dir="ltr" className="col-span-2 text-end font-mono text-xs sm:col-span-1">
                <strong className="text-sm text-ink">{cluster.count}</strong>
                {share !== null ? <span className="ms-1 text-ink-muted">{share}%</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
