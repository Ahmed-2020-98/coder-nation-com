import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { MonthNav } from "@/components/attendance-ui";
import { InvoiceBadge } from "@/components/badges";
import { Card } from "@/components/ui/Card";
import { isValidMonth, monthOf } from "@/lib/attendance-rules";
import { PAYMENT_METHOD_LABEL } from "@/lib/client-contract-rules";
import type { Currency } from "@/lib/crm-rules";
import { todayInCairo } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { listInvoices } from "@/server/invoices";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "الفواتير" };

/** "2026-02" -> ["2026-02-01", "2026-02-28"]. */
function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission("invoice.issue");
  const { month: asked } = await searchParams;
  const month = asked && isValidMonth(asked) ? asked : monthOf(todayInCairo());
  const [from, to] = monthRange(month);
  const invoices = await listInvoices({ from, to });
  // Money in different currencies is never added together.
  const collected = new Map<Currency, number>();
  for (const invoice of invoices) if (invoice.status === "issued") collected.set(invoice.currency, (collected.get(invoice.currency) ?? 0) + invoice.amountMinor);

  return (
    <>
      <PageHeader title="الفواتير" description="كل دفعة بتتسجّل على عقد عميل بتطلّع فاتورة برقم مسلسل. الفواتير هنا حسب تاريخ الدفع." />
      <MonthNav month={month} base="/invoices" />
      <dl className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <dt className="text-xs text-ink-muted">المحصّل في الشهر</dt>
          <dd className="mt-1 grid gap-0.5 text-xl font-bold">
            {collected.size === 0 ? <span>—</span> : [...collected].map(([currency, total]) => <span key={currency}>{formatMoney(total, currency)}</span>)}
          </dd>
        </Card>
        <Card className="p-4">
          <dt className="text-xs text-ink-muted">عدد الفواتير السارية</dt>
          <dd dir="ltr" className="mt-1 text-start font-mono text-2xl font-bold">{invoices.filter((i) => i.status === "issued").length}</dd>
        </Card>
      </dl>
      {invoices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-ink-muted">
          مفيش فواتير في الشهر ده. الدفعة بتتسجّل من صفحة <Link href="/client-contracts" className="font-semibold text-accent underline-offset-4 hover:underline">عقد العميل</Link>.
        </p>
      ) : (
        <Card className="overflow-hidden">
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">الفواتير</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th scope="col" className="px-4 py-3 text-start font-medium">الرقم</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">العميل / العقد</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">المبلغ</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">الطريقة</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">تاريخ الدفع</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-canvas-alt">
                    <td className="px-4 py-3 font-mono" dir="ltr">
                      <Link href={`/invoices/${invoice.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{invoice.clientName}</p>
                      <p className="text-ink-muted">
                        <bdi dir="ltr">{invoice.contractNumber}</bdi> · {invoice.milestoneTitle ?? invoice.contractTitle}
                      </p>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap ${invoice.status === "void" ? "line-through text-ink-muted" : "font-semibold"}`}>{formatMoney(invoice.amountMinor, invoice.currency)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{PAYMENT_METHOD_LABEL[invoice.method]}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(invoice.paidOn)}</td>
                    <td className="px-4 py-3">
                      <InvoiceBadge status={invoice.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
