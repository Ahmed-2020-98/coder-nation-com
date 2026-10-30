import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { QuickMove } from "@/components/QuickMove";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { OPEN_STAGES, STAGE_LABEL, SOURCE_LABEL, type Stage } from "@/lib/crm-rules";
import { formatDateTime, isPast } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { listDeals, type DealSummary } from "@/server/crm";
import { can } from "@/server/permissions";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "الصفقات" };

function DealCard({ deal, canMove }: { deal: DealSummary; canMove: boolean }) {
  const overdue = deal.nextFollowUpAt !== null && isPast(deal.nextFollowUpAt);
  return (
    <li className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
      <Link href={`/crm/deals/${deal.id}`} className="block font-semibold underline-offset-4 hover:text-accent hover:underline">
        {deal.title}
      </Link>
      <p className="mt-0.5 text-sm text-ink-muted">{deal.clientName}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {deal.valueMinor !== null && deal.currency ? (
          <Badge tone="neutral" mono>
            {formatMoney(deal.valueMinor, deal.currency)}
          </Badge>
        ) : null}
        {deal.source === "website" ? <Badge tone="accent">{SOURCE_LABEL.website}</Badge> : null}
        {deal.nextFollowUpAt ? (
          <Badge tone={overdue ? "error" : "neutral"}>
            {overdue ? "متابعة متأخرة" : `متابعة ${formatDateTime(deal.nextFollowUpAt)}`}
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-muted">{deal.ownerName ? `المسؤول: ${deal.ownerName}` : "من غير مسؤول"}</p>
      {canMove && deal.stage !== "lost" ? (
        <div className="mt-2.5">
          <QuickMove id={deal.id} stage={deal.stage} />
        </div>
      ) : null}
    </li>
  );
}

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const own = !can(user.role, "deal.view_all");
  const deals = await listDeals({ ownerId: own ? user.id : undefined, q });
  const byStage = (stage: Stage) => deals.filter((deal) => deal.stage === stage);
  const closed = deals.filter((deal) => deal.stage === "won" || deal.stage === "lost");
  const canMove = can(user.role, "deal.move");

  return (
    <>
      <PageHeader
        title="الصفقات"
        description={own ? "الصفقات المسندة ليك." : `${deals.length} صفقة`}
        actions={
          can(user.role, "deal.create") ? (
            <Button href="/crm/deals/new" size="sm">
              <Plus aria-hidden="true" className="size-4" />
              صفقة جديدة
            </Button>
          ) : null
        }
      />

      <form role="search" action="/crm" className="mb-6 flex max-w-xl items-end gap-3">
        <div className="flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-semibold">
            بحث (عنوان الصفقة أو اسم العميل)
          </label>
          <input id="q" name="q" defaultValue={q ?? ""} maxLength={100} className={inputClass} />
        </div>
        <Button type="submit" variant="secondary">
          <Search aria-hidden="true" className="size-4" />
          بحث
        </Button>
      </form>

      <div className="thin-scroll -mx-(--gutter) overflow-x-auto px-(--gutter) pb-3">
        <div className="grid min-w-[72rem] grid-cols-6 items-start gap-3">
          {OPEN_STAGES.map((stage) => (
            <section key={stage} aria-labelledby={`col-${stage}`} className="rounded-xl bg-canvas-alt p-2.5">
              <h2 id={`col-${stage}`} className="mb-2.5 flex items-center justify-between px-1 text-sm font-bold">
                {STAGE_LABEL[stage]}
                <span dir="ltr" className="font-mono text-xs text-ink-muted">
                  {byStage(stage).length}
                </span>
              </h2>
              <ul className="grid gap-2.5">
                {byStage(stage).map((deal) => (
                  <DealCard key={deal.id} deal={deal} canMove={canMove} />
                ))}
              </ul>
            </section>
          ))}
          <section aria-labelledby="col-closed" className="rounded-xl bg-canvas-alt p-2.5">
            <h2 id="col-closed" className="mb-2.5 flex items-center justify-between px-1 text-sm font-bold">
              منتهية (فاز / خسر)
              <span dir="ltr" className="font-mono text-xs text-ink-muted">
                {closed.length}
              </span>
            </h2>
            <ul className="grid gap-2.5">
              {closed.map((deal) => (
                <li key={deal.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
                  <Link href={`/crm/deals/${deal.id}`} className="block font-semibold underline-offset-4 hover:text-accent hover:underline">
                    {deal.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-muted">{deal.clientName}</p>
                  <div className="mt-2">
                    <Badge tone={deal.stage === "won" ? "success" : "error"}>{STAGE_LABEL[deal.stage]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
