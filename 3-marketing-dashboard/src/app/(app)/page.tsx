import Link from "next/link";
import { Search } from "lucide-react";
import { Board } from "@/components/kanban/Board";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { RunStatusChip } from "@/components/ui/Status";
import { formatDateTime, formatUsd } from "@/lib/format";
import { RUN_KIND_LABEL } from "@/lib/stages";
import { listRuns } from "@/server/db";
import { env } from "@/server/env";
import { getBoard } from "@/server/services/cards";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const cards = getBoard();
  const runs = listRuns({ limit: 8 });
  const spent = listRuns({ limit: 1000 }).reduce((sum, run) => sum + (run.costUsd ?? 0), 0);

  return (
    <>
      <PageHeader
        index="01"
        title="لوحة المتابعة"
        description="كل فيديو كارت واحد بيتحرك بين المراحل بعد موافقتك. مفيش حاجة بتنتقل لوحدها."
        actions={
          <Button href="/research">
            <Search aria-hidden="true" className="size-4" />
            تحليل كومنتات جديدة
          </Button>
        }
      />

      <Board cards={cards} />

      <section aria-labelledby="runs-title" className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="runs-title" className="text-lg font-bold">
            آخر التشغيلات
          </h2>
          <p className="text-sm text-ink-muted">
            {env.authMode === "subscription" ? "الاستهلاك التقديري التراكمي (مش بيتدفع على اشتراكك):" : "الإنفاق التقديري التراكمي:"}{" "}
            <span dir="ltr" className="font-mono font-semibold text-ink">
              {formatUsd(spent)}
            </span>
          </p>
        </div>
        {runs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
            لسه مفيش تشغيلات. ابدأ بـ <Link href="/research" className="font-semibold text-accent underline-offset-4 hover:underline">Research</Link>.
          </p>
        ) : (
          <div className="thin-scroll overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[32rem] text-sm">
              <caption className="sr-only">آخر التشغيلات</caption>
              <thead>
                <tr className="border-b border-line text-start text-xs text-ink-muted">
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">العملية</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">الكارت / الدفعة</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">الحالة</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">التكلفة</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-2.5 font-medium">{RUN_KIND_LABEL[run.kind]}</td>
                    <td className="px-4 py-2.5">
                      <span dir="ltr" className="font-mono text-xs text-ink-muted">
                        {run.label ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <RunStatusChip status={run.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span dir="ltr" className="font-mono text-xs">
                        {formatUsd(run.costUsd)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(run.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
