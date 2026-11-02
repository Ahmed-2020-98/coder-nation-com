import { PlainText } from "@/components/PlainText";
import { fillClientTokens, formatWeeks, totalWeeks } from "@/lib/client-contract-rules";
import { formatDateLong } from "@/lib/format";
import { formatMoney, formatPercentBp } from "@/lib/money";
import type { ClientContract } from "@/server/client-contracts";
import type { Company } from "@/server/company";

const th = "border-b-2 border-secondary-900 px-3 py-2.5 text-start text-sm font-bold";
const td = "border-b border-line px-3 py-2.5 align-top";

/**
 * The client contract as it is printed and signed: the parties, the numbered clauses (tokens filled in), then as
 * annexes the scope, timeline, prices and payment schedule copied from the accepted proposal, and the signature lines.
 */
export function ClientContractDocument({ contract, company }: { contract: ClientContract; company: Company }) {
  const companyName = company.name || "Coder Nation";
  const money = (minor: number) => formatMoney(minor, contract.currency);
  const facts = { ...contract, companyName };
  const subtotal = contract.items.reduce((sum, item) => sum + item.quantity * item.unitPriceMinor, 0);
  const taxMinor = contract.totalMinor - (subtotal - contract.discountMinor);
  const weeks = totalWeeks(contract.timeline);
  const ltr = new Set(["الموبايل", "الإيميل", "رقم السجل / الهوية"]);
  const second: [string, string][] = (
    [
      ["الاسم", contract.clientName],
      ["يمثّله", contract.clientRepresentative],
      ["رقم السجل / الهوية", contract.clientIdNumber],
      ["العنوان", contract.clientAddress],
      ["الموبايل", contract.clientPhone],
      ["الإيميل", contract.clientEmail],
    ] as [string, string][]
  ).filter(([, value]) => value);

  return (
    <article className="text-[11.5pt] text-secondary-900">
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
          <p className="font-heading text-[15pt] font-bold">عقد تنفيذ مشروع</p>
          <p dir="ltr" className="font-mono text-[12pt] font-bold text-accent">{contract.number}</p>
          <p className="text-neutral-600">التاريخ: {formatDateLong(contract.signedOn ?? contract.readyAt ?? contract.updatedAt)}</p>
          <p className="text-neutral-600">
            بناءً على العرض: <bdi dir="ltr">{contract.proposalNumber}</bdi>
          </p>
        </div>
      </header>

      <h1 className="mt-6 font-heading text-[18pt] leading-snug font-bold">{contract.title}</h1>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <div className="rounded-lg border border-line p-4">
          <h2 className="font-heading text-[12pt] font-bold">الطرف الأول (مقدّم الخدمة)</h2>
          <p className="mt-2">{companyName}</p>
          {company.address ? <p className="text-[10pt] text-neutral-600">{company.address}</p> : null}
        </div>
        <div className="rounded-lg border border-line p-4">
          <h2 className="font-heading text-[12pt] font-bold">الطرف الثاني (العميل)</h2>
          <dl className="mt-2 grid gap-1 text-[10.5pt]">
            {second.map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="shrink-0 text-neutral-600">{label}:</dt>
                <dd dir={ltr.has(label) ? "ltr" : undefined} className="min-w-0 break-words">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mt-7">
        {contract.clauses.map((clause, index) => (
          <div key={index} className="mt-5 break-inside-avoid">
            <h2 className="font-heading text-[12.5pt] font-bold">
              البند {index + 1}: {clause.title}
            </h2>
            <PlainText text={fillClientTokens(clause.body, facts)} />
          </div>
        ))}
      </section>

      <section className="mt-10 break-before-page">
        <h2 className="border-s-4 border-primary-500 ps-3 font-heading text-[14pt] font-bold">ملحق (1): نطاق العمل والجدول الزمني</h2>
        {contract.sections.map((section, index) => (
          <div key={index} className="mt-4 break-inside-avoid">
            <h3 className="font-heading text-[12pt] font-bold">
              {index + 1}. {section.title}
            </h3>
            <PlainText text={section.body} />
          </div>
        ))}
        {contract.timeline.length > 0 ? (
          <div className="mt-5 break-inside-avoid">
            <h3 className="font-heading text-[12pt] font-bold">الجدول الزمني</h3>
            <table className="mt-2 w-full border-collapse text-[10.5pt]">
              <thead>
                <tr>
                  <th className={th}>المرحلة</th>
                  <th className={th}>المدة</th>
                </tr>
              </thead>
              <tbody>
                {contract.timeline.map((phase, index) => (
                  <tr key={index}>
                    <td className={td}>{phase.title}</td>
                    <td className={td}>{formatWeeks(phase.weeks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10pt] text-neutral-600">
              إجمالي المدة التقديرية: {formatWeeks(weeks)}
              {contract.startDate ? ` تبدأ من ${formatDateLong(contract.startDate)}.` : "."}
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-10 break-inside-avoid">
        <h2 className="border-s-4 border-primary-500 ps-3 font-heading text-[14pt] font-bold">ملحق (2): قيمة العقد وجدول الدفعات</h2>
        <table className="mt-4 w-full border-collapse text-[10.5pt]">
          <thead>
            <tr>
              <th className={th}>#</th>
              <th className={th}>البند</th>
              <th className={th}>الكمية</th>
              <th className={th}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {contract.items.map((item, index) => (
              <tr key={index} className="break-inside-avoid">
                <td className={`${td} font-mono`}>{index + 1}</td>
                <td className={td}>
                  <p className="font-semibold">{item.title}</p>
                  {item.description ? <p className="text-[10pt] leading-6 text-neutral-600">{item.description}</p> : null}
                </td>
                <td className={`${td} font-mono`}>{item.quantity}</td>
                <td className={`${td} whitespace-nowrap font-semibold`}>{money(item.quantity * item.unitPriceMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 ms-auto grid w-full max-w-[85mm] gap-1.5 text-[11pt]">
          {contract.discountMinor > 0 || contract.taxRateBp !== null ? (
            <div className="flex justify-between"><dt>الإجمالي قبل الخصم</dt><dd>{money(subtotal)}</dd></div>
          ) : null}
          {contract.discountMinor > 0 ? <div className="flex justify-between"><dt>الخصم</dt><dd><bdi dir="ltr">- {money(contract.discountMinor)}</bdi></dd></div> : null}
          {contract.taxRateBp !== null ? <div className="flex justify-between"><dt>الضريبة (<bdi>{formatPercentBp(contract.taxRateBp)}</bdi>)</dt><dd>{money(taxMinor)}</dd></div> : null}
          <div className="mt-1 flex justify-between rounded-lg bg-secondary-900 px-3 py-2.5 text-[12.5pt] font-bold text-white"><dt>إجمالي قيمة العقد</dt><dd>{money(contract.totalMinor)}</dd></div>
        </dl>

        {contract.milestones.length > 0 ? (
          <table className="mt-5 w-full border-collapse text-[10.5pt]">
            <thead>
              <tr>
                <th className={th}>الدفعة</th>
                <th className={th}>النسبة</th>
                <th className={th}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {contract.milestones.map((milestone, index) => (
                <tr key={index}>
                  <td className={td}>{milestone.title}</td>
                  <td className={`${td} font-mono`} dir="ltr"><span className="block text-start">{formatPercentBp(milestone.percentBp)}</span></td>
                  <td className={`${td} whitespace-nowrap font-semibold`}>{money(milestone.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <footer className="mt-10 break-inside-avoid">
        <div className="grid grid-cols-2 gap-10 pt-4 text-[10.5pt]">
          {[
            ["الطرف الأول", companyName],
            ["الطرف الثاني", contract.clientName],
          ].map(([party, name]) => (
            <div key={party}>
              <p className="font-bold">{party}</p>
              <p className="text-neutral-600">{name}</p>
              <p className="mt-6 text-neutral-600">الاسم: ....................................</p>
              <p className="mt-10 border-t border-neutral-400 pt-1 text-neutral-600">التوقيع</p>
            </div>
          ))}
        </div>
        {contract.status === "signed" && contract.signedOn ? (
          <p className="mt-6 text-[10pt] text-neutral-600">
            وُقّع هذا العقد يوم {formatDateLong(contract.signedOn)}
            {contract.signedByName ? `، ووقّع عن الطرف الثاني: ${contract.signedByName}` : ""}.
          </p>
        ) : null}
      </footer>
    </article>
  );
}
