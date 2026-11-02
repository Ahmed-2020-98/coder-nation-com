import { PlainText } from "@/components/PlainText";
import { fillTokens, formatClock, formatSalary, formatWorkDays } from "@/lib/contract-rules";
import { formatDateLong, formatTime } from "@/lib/format";
import type { Company } from "@/server/company";
import type { Contract } from "@/server/contracts";

/**
 * The contract as the employee reads it and as it is printed: the parties, the agreed facts, the numbered clauses
 * (tokens filled in) and either the record of the electronic acceptance or blank signature lines.
 */
export function ContractDocument({ contract, company }: { contract: Contract; company: Company }) {
  const companyName = company.name || "Coder Nation";
  const second: [string, string][] = (
    [
      ["الاسم", contract.employeeName],
      ["المسمى الوظيفي", contract.jobTitle],
      ["الرقم القومي", contract.nationalId],
      ["العنوان", contract.address],
      ["الموبايل", contract.phone],
      ["الإيميل", contract.email],
    ] as [string, string][]
  ).filter(([, value]) => value);
  const facts: [string, string][] = (
    [
      ["تاريخ بدء العمل", contract.startDate ? formatDateLong(contract.startDate) : ""],
      ["مواعيد العمل", `من ${formatClock(contract.workStart)} إلى ${formatClock(contract.workEnd)}`],
      ["أيام العمل", formatWorkDays(contract.workDays)],
      ["المرتب", formatSalary(contract)],
      ["العمولة", contract.commission],
    ] as [string, string][]
  ).filter(([, value]) => value);
  const ltr = new Set(["الموبايل", "الإيميل", "الرقم القومي"]);

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
          </div>
        </div>
        <div className="text-end text-[10pt] leading-7">
          <p className="font-heading text-[15pt] font-bold">عقد عمل</p>
          <p dir="ltr" className="font-mono text-[12pt] font-bold text-accent">{contract.number}</p>
          <p className="text-neutral-600">التاريخ: {formatDateLong(contract.sentAt ?? contract.updatedAt)}</p>
        </div>
      </header>

      <h1 className="mt-6 font-heading text-[18pt] leading-snug font-bold">{contract.title}</h1>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <div className="rounded-lg border border-line p-4">
          <h2 className="font-heading text-[12pt] font-bold">الطرف الأول (صاحب العمل)</h2>
          <p className="mt-2">{companyName}</p>
          {company.address ? <p className="text-[10pt] text-neutral-600">{company.address}</p> : null}
        </div>
        <div className="rounded-lg border border-line p-4">
          <h2 className="font-heading text-[12pt] font-bold">الطرف الثاني (الموظف)</h2>
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

      <section className="mt-5 break-inside-avoid">
        <h2 className="border-s-4 border-primary-500 ps-3 font-heading text-[14pt] font-bold">بيانات التعاقد</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 print:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="border-b border-line pb-2">
              <dt className="text-[10pt] text-neutral-600">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-7">
        <h2 className="border-s-4 border-primary-500 ps-3 font-heading text-[14pt] font-bold">البنود</h2>
        {contract.clauses.map((clause, index) => (
          <div key={index} className="mt-5 break-inside-avoid">
            <h3 className="font-heading text-[12.5pt] font-bold">
              البند {index + 1}: {clause.title}
            </h3>
            <PlainText text={fillTokens(clause.body, contract)} />
          </div>
        ))}
      </section>

      <footer className="mt-10 break-inside-avoid">
        {contract.status === "accepted" && contract.respondedAt ? (
          <p className="rounded-lg border border-success-500/40 bg-success-500/10 px-4 py-3 text-[10.5pt] leading-7">
            وافق الطرف الثاني ({contract.employeeName}) على هذا الاتفاق إلكترونيًا من حسابه في النظام الداخلي يوم {formatDateLong(contract.respondedAt)} الساعة{" "}
            <bdi dir="ltr">{formatTime(contract.respondedAt)}</bdi> بتوقيت القاهرة.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-10 pt-4 text-[10.5pt]">
            {["الطرف الأول", "الطرف الثاني"].map((party) => (
              <div key={party}>
                <p className="font-bold">{party}</p>
                <p className="mt-10 border-t border-neutral-400 pt-1 text-neutral-600">التوقيع</p>
              </div>
            ))}
          </div>
        )}
      </footer>
    </article>
  );
}
