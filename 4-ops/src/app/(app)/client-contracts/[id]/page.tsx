import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download, Receipt } from "lucide-react";
import { BackToDraft, CancelContract, MarkReady, PaymentForm, SignForm } from "../ClientContractForms";
import { ClientContractEditor } from "./ClientContractEditor";
import { ClientContractDocument } from "@/components/ClientContractDocument";
import { PageHeader } from "@/components/PageHeader";
import { ClientContractBadge, InvoiceBadge } from "@/components/badges";
import { Card } from "@/components/ui/Card";
import { PAYMENT_METHOD_LABEL, clientContractProblems, paidPerMilestone, paymentSummary, takesPayments } from "@/lib/client-contract-rules";
import { todayInCairo } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { formatMoney, toDecimalText } from "@/lib/money";
import { contractFacts, getClientContract } from "@/server/client-contracts";
import { getCompany } from "@/server/company";
import { listInvoices } from "@/server/invoices";
import { can } from "@/server/permissions";
import { requirePermission } from "@/server/session";

export const metadata: Metadata = { title: "عقد عميل" };

export default async function ClientContractPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("client_contract.manage");
  const { id } = await params;
  const contract = await getClientContract(id);
  if (!contract) notFound();
  const [company, invoices, facts] = await Promise.all([getCompany(), listInvoices({ contractId: id }), contractFacts(contract)]);
  const money = (minor: number) => formatMoney(minor, contract.currency);
  const { paidMinor, remainingMinor } = paymentSummary(contract.totalMinor, invoices);
  const perMilestone = paidPerMilestone(contract.milestones.length, invoices);
  const milestoneLeft = contract.milestones.map((m, i) => Math.max(0, m.amountMinor - perMilestone[i]));
  const next = milestoneLeft.findIndex((left) => left > 0);
  const today = todayInCairo();
  const problems = contract.status === "draft" ? clientContractProblems(facts) : [];
  const liveInvoices = invoices.filter((i) => i.status === "issued").length;

  return (
    <>
      <Link href="/client-contracts" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent">
        <ArrowRight aria-hidden="true" className="size-4" />
        عقود العملاء
      </Link>
      <PageHeader
        title={`${contract.clientName}: ${contract.title}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span dir="ltr" className="font-mono">{contract.number}</span>
            <ClientContractBadge status={contract.status} />
            <Link href={`/proposals/${contract.proposalId}`} className="text-sm underline-offset-4 hover:text-accent hover:underline">
              من العرض <bdi dir="ltr">{contract.proposalNumber}</bdi>
            </Link>
            <Link href={`/crm/deals/${contract.dealId}`} className="text-sm underline-offset-4 hover:text-accent hover:underline">
              · الصفقة
            </Link>
          </span>
        }
        actions={
          <a href={`/api/client-contracts/${contract.id}/pdf`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-5 font-semibold hover:border-accent hover:text-accent">
            <Download aria-hidden="true" className="size-4" />
            {contract.status === "draft" ? "PDF (مسودة)" : "تحميل PDF للتوقيع"}
          </a>
        }
      />

      {contract.status === "cancelled" ? (
        <Card className="mb-6 p-4 text-sm">العقد ده ملغي: «{contract.cancelReason}». تقدر تعمل عقد جديد من نفس العرض.</Card>
      ) : null}

      {contract.status === "draft" ? (
        <ClientContractEditor
          contract={{
            id: contract.id,
            title: contract.title,
            clientName: contract.clientName,
            clientRepresentative: contract.clientRepresentative,
            clientIdNumber: contract.clientIdNumber,
            clientAddress: contract.clientAddress,
            clientPhone: contract.clientPhone,
            clientEmail: contract.clientEmail,
            startDate: contract.startDate,
            clauses: contract.clauses,
            companyName: facts.companyName,
            proposalNumber: contract.proposalNumber,
            totalMinor: contract.totalMinor,
            currency: contract.currency,
            timeline: contract.timeline,
          }}
        />
      ) : (
        <Card className="p-6 sm:p-9">
          <ClientContractDocument contract={contract} company={company} />
        </Card>
      )}

      {contract.status !== "cancelled" ? (
        <Card className="mt-6 grid gap-4 p-6">
          <h2 className="text-lg font-bold">حالة العقد</h2>
          {contract.status === "draft" ? <MarkReady id={contract.id} problem={problems[0] ?? null} /> : null}
          {contract.status === "ready" ? (
            <>
              <p className="text-sm">نزّل الـ PDF واطبعه نسختين. لما العميل يوقّع سجّل التوقيع هنا.</p>
              <SignForm id={contract.id} today={today} defaultName={contract.clientRepresentative || contract.clientName} />
              {liveInvoices === 0 ? <BackToDraft id={contract.id} /> : null}
            </>
          ) : null}
          {contract.status === "signed" ? (
            <p className="text-sm text-ink-muted">
              العميل وقّع يوم {formatDate(contract.signedOn!)}
              {contract.signedByName ? ` (${contract.signedByName})` : ""}. العقد مقفول نهائيًا.
            </p>
          ) : null}
          <details className="border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink-muted">إلغاء العقد</summary>
            <div className="mt-3">
              {liveInvoices > 0 ? <p className="text-sm text-ink-muted">على العقد فواتير سارية. الغيها الأول (من صفحة كل فاتورة) قبل إلغاء العقد.</p> : <CancelContract id={contract.id} />}
            </div>
          </details>
        </Card>
      ) : null}

      {contract.status !== "draft" ? (
        <Card className="mt-6 grid gap-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Receipt aria-hidden="true" className="size-5 text-accent" />
            الدفعات والفواتير
          </h2>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["إجمالي العقد", money(contract.totalMinor)],
              ["المدفوع", money(paidMinor)],
              ["المتبقي", money(remainingMinor)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line px-4 py-3">
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="mt-1 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          {contract.milestones.length > 0 ? (
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <caption className="sr-only">جدول الدفعات</caption>
                <thead>
                  <tr className="border-b border-line text-xs text-ink-muted">
                    <th scope="col" className="px-3 py-2 text-start font-medium">الدفعة</th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">المستحق</th>
                    <th scope="col" className="px-3 py-2 text-start font-medium">المحصّل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {contract.milestones.map((m, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{m.title}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{money(m.amountMinor)}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${milestoneLeft[i] === 0 ? "font-semibold text-success-700" : ""}`}>{money(perMilestone[i])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {takesPayments(contract.status) && remainingMinor > 0 && can(user.role, "invoice.issue") ? (
            <div className="border-t border-line pt-5">
              <h3 className="mb-3 font-bold">سجّل دفعة وصلت</h3>
              <PaymentForm
                contractId={contract.id}
                today={today}
                currency={contract.currency}
                defaultAmount={toDecimalText(next === -1 ? remainingMinor : Math.min(milestoneLeft[next], remainingMinor))}
                defaultMilestone={next === -1 ? null : next}
                milestones={contract.milestones.map((m, i) => ({ title: m.title, remaining: money(milestoneLeft[i]) }))}
              />
            </div>
          ) : null}
          {remainingMinor === 0 ? <p className="text-sm font-semibold text-success-700">العقد اتدفع بالكامل. ✔</p> : null}

          <div className="border-t border-line pt-5">
            <h3 className="mb-3 font-bold">الفواتير</h3>
            {invoices.length === 0 ? (
              <p className="text-sm text-ink-muted">لسه مفيش دفعات متسجّلة.</p>
            ) : (
              <ul className="grid gap-2.5 text-sm">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3">
                    <Link href={`/invoices/${invoice.id}`} className="font-semibold underline-offset-4 hover:text-accent hover:underline">
                      <bdi dir="ltr">{invoice.number}</bdi>
                    </Link>
                    <span className="flex flex-wrap items-center gap-2 text-ink-muted">
                      <span>{formatDate(invoice.paidOn)}</span>
                      <span>· {PAYMENT_METHOD_LABEL[invoice.method]}</span>
                      <span className={invoice.status === "void" ? "line-through" : "font-semibold text-ink"}>{money(invoice.amountMinor)}</span>
                      <InvoiceBadge status={invoice.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}
    </>
  );
}
