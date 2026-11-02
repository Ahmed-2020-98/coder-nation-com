import { PAYMENT_METHOD_LABEL } from "@/lib/client-contract-rules";
import { formatDateLong } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { ClientContract } from "@/server/client-contracts";
import type { Company } from "@/server/company";
import type { Invoice } from "@/server/invoices";

const th = "border-b-2 border-secondary-900 px-3 py-2.5 text-start text-sm font-bold";
const td = "border-b border-line px-3 py-2.5 align-top";

/**
 * The invoice for one payment, as shown and printed: who paid, for which contract, how much, and where the contract
 * stood right after it (paid so far, remaining). An internal document, and it says so.
 */
export function InvoiceDocument({ invoice, contract, company, paidMinor }: { invoice: Invoice; contract: ClientContract; company: Company; paidMinor: number }) {
  const companyName = company.name || "Coder Nation";
  const money = (minor: number) => formatMoney(minor, invoice.currency);
  const remaining = Math.max(0, contract.totalMinor - paidMinor);
  const client: [string, string, boolean][] = (
    [
      ["العميل", contract.clientName, false],
      ["يمثّله", contract.clientRepresentative, false],
      ["العنوان", contract.clientAddress, false],
      ["الموبايل", contract.clientPhone, true],
      ["الإيميل", contract.clientEmail, true],
    ] as [string, string, boolean][]
  ).filter(([, value]) => value);

  return (
    <article className="relative text-[11.5pt] text-secondary-900">
      {invoice.status === "void" ? (
        <p aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[45%] -rotate-12 text-center font-heading text-[54pt] font-bold text-error-500/25">
          ملغاة
        </p>
      ) : null}
      <header className="flex items-start justify-between gap-6 border-b-4 border-primary-500 pb-5">
        <div>
          <p dir="ltr" className="text-start font-heading text-[20pt] leading-tight font-bold">
            {companyName}
          </p>
          <div className="mt-2 text-[10pt] leading-6 text-neutral-600">
            {company.address ? <p>{company.address}</p> : null}
            {company.email || company.phone ? (
              <p dir="ltr" className="text-start">
                {[company.email, company.phone].filter(Boolean).join("  ·  ")}
              </p>
            ) : null}
            {company.taxNumber ? <p>الرقم الضريبي: <span dir="ltr">{company.taxNumber}</span></p> : null}
          </div>
        </div>
        <div className="text-end text-[10pt] leading-7">
          <p className="font-heading text-[15pt] font-bold">فاتورة</p>
          <p dir="ltr" className="font-mono text-[12pt] font-bold text-accent">{invoice.number}</p>
          <p className="text-neutral-600">تاريخ الدفع: {formatDateLong(invoice.paidOn)}</p>
          <p className="text-neutral-600">
            العقد: <bdi dir="ltr">{contract.number}</bdi>
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <div className="rounded-lg border border-line p-4">
          <h2 className="font-heading text-[12pt] font-bold">فاتورة إلى</h2>
          <dl className="mt-2 grid gap-1 text-[10.5pt]">
            {client.map(([label, value, ltr]) => (
              <div key={label} className="flex gap-2">
                <dt className="shrink-0 text-neutral-600">{label}:</dt>
                <dd dir={ltr ? "ltr" : undefined} className="min-w-0 break-words">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-lg border border-line p-4">
          <h2 className="font-heading text-[12pt] font-bold">بيانات الدفع</h2>
          <dl className="mt-2 grid gap-1 text-[10.5pt]">
            <div className="flex gap-2">
              <dt className="text-neutral-600">طريقة الدفع:</dt>
              <dd>{PAYMENT_METHOD_LABEL[invoice.method]}</dd>
            </div>
            {invoice.reference ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-neutral-600">رقم العملية:</dt>
                <dd dir="ltr" className="min-w-0 break-words">{invoice.reference}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      <table className="mt-7 w-full border-collapse text-[10.5pt]">
        <thead>
          <tr>
            <th className={th}>البيان</th>
            <th className={th}>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={td}>
              <p className="font-semibold">{invoice.milestoneTitle ? `${invoice.milestoneTitle}: ${contract.title}` : `دفعة من قيمة: ${contract.title}`}</p>
              <p className="text-[10pt] text-neutral-600">
                بموجب العقد <bdi dir="ltr">{contract.number}</bdi>
                {invoice.note ? ` · ${invoice.note}` : ""}
              </p>
            </td>
            <td className={`${td} whitespace-nowrap font-semibold`}>{money(invoice.amountMinor)}</td>
          </tr>
        </tbody>
      </table>

      <dl className="mt-4 ms-auto grid w-full max-w-[95mm] gap-1.5 text-[11pt]">
        <div className="flex justify-between rounded-lg bg-secondary-900 px-3 py-2.5 text-[12.5pt] font-bold text-white">
          <dt>المبلغ المستلم</dt>
          <dd>{money(invoice.amountMinor)}</dd>
        </div>
        <div className="mt-2 flex justify-between"><dt>إجمالي قيمة العقد</dt><dd>{money(contract.totalMinor)}</dd></div>
        <div className="flex justify-between"><dt>إجمالي المدفوع حتى تاريخه</dt><dd>{money(paidMinor)}</dd></div>
        <div className="flex justify-between font-bold"><dt>المتبقي</dt><dd>{money(remaining)}</dd></div>
      </dl>

      <p className="mt-8 text-[10pt] leading-7 text-neutral-600">
        المبالغ بعملة: {invoice.currency}
        {contract.taxRateBp !== null ? "، وهي شاملة الضريبة الواردة في العقد." : "."}
      </p>
      {invoice.status === "void" ? (
        <p className="mt-2 text-[10.5pt] font-bold text-error-700">هذه الفاتورة ملغاة{invoice.voidReason ? `: ${invoice.voidReason}` : "."}</p>
      ) : null}
      <p className="mt-6 border-t border-line pt-3 text-[9pt] text-neutral-500">مستند داخلي لإثبات استلام المبلغ، وليس فاتورة ضريبية إلكترونية.</p>
    </article>
  );
}
