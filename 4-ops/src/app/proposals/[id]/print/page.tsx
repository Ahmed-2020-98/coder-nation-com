import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateLong } from "@/lib/format";
import { computeTotals, formatMoney, formatPercentBp, splitPayments } from "@/lib/money";
import { getCompany } from "@/server/company";
import { getProposal } from "@/server/proposals";
import { requirePermission } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const proposal = await getProposal((await params).id).catch(() => null);
  // The PDF's title (shown by viewers and used as its name when saved) is the proposal number and title.
  return { title: proposal ? `${proposal.number} | ${proposal.title}` : "عرض", robots: { index: false, follow: false } };
}

/** Plain text -> paragraphs and bullet lists ("- " at the start of a line). Everything is escaped by React. */
function Body({ text }: { text: string }) {
  const blocks: { bullets: boolean; lines: string[] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.startsWith("- ");
    const last = blocks[blocks.length - 1];
    if (last && last.bullets === bullet) last.lines.push(bullet ? line.slice(2) : line);
    else blocks.push({ bullets: bullet, lines: [bullet ? line.slice(2) : line] });
  }
  return (
    <>
      {blocks.map((block, index) =>
        block.bullets ? (
          <ul key={index} className="my-2 list-disc ps-6 leading-8">
            {block.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          block.lines.map((line, i) => (
            <p key={`${index}-${i}`} className="my-2 leading-8">
              {line}
            </p>
          ))
        ),
      )}
    </>
  );
}

const th = "border-b-2 border-secondary-900 px-3 py-2.5 text-start text-sm font-bold";
const td = "border-b border-line px-3 py-2.5 align-top";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("proposal.export");
  const { id } = await params;
  const [proposal, company] = await Promise.all([getProposal(id), getCompany()]);
  if (!proposal) notFound();

  const money = (minor: number) => formatMoney(minor, proposal.currency);
  const totals = computeTotals(proposal.items, proposal.discountMinor, proposal.taxRateBp);
  const payments = splitPayments(totals.totalMinor, proposal.milestones.map((m) => m.percentBp));
  const totalWeeks = proposal.timeline.reduce((sum, phase) => sum + phase.weeks, 0);
  const weekEnds = proposal.timeline.map((_, i) => proposal.timeline.slice(0, i + 1).reduce((sum, phase) => sum + phase.weeks, 0));

  return (
    <div data-tone="light" className="mx-auto w-full max-w-[210mm] bg-white px-[15mm] text-[11.5pt] text-secondary-900">
      {/* The whole sheet is white, including the strip below the last block of the last page. */}
      <style>{"html, body { background: #fff !important; }"}</style>
      <header className="flex items-start justify-between gap-6 border-b-4 border-primary-500 pb-5">
        <div>
          <p dir="ltr" className="text-start font-heading text-[22pt] leading-tight font-bold">
            {company.name || "Coder Nation"}
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
          <p className="font-heading text-[15pt] font-bold">عرض فني ومالي</p>
          <p dir="ltr" className="font-mono text-[12pt] font-bold text-accent">{proposal.number}</p>
          <p className="text-neutral-600">التاريخ: {formatDateLong(proposal.sentAt ?? new Date())}</p>
          {proposal.validUntil ? <p className="text-neutral-600">ساري حتى: {formatDateLong(proposal.validUntil)}</p> : null}
        </div>
      </header>

      <section className="mt-6">
        <p className="text-[10pt] text-neutral-600">مُقدَّم إلى</p>
        <p className="font-heading text-[16pt] font-bold">{proposal.clientName}</p>
        <h1 className="mt-4 font-heading text-[18pt] leading-snug font-bold">{proposal.title}</h1>
        {proposal.intro ? <Body text={proposal.intro} /> : null}
      </section>

      <section className="mt-8">
        <h2 className="border-s-4 border-primary-500 ps-3 font-heading text-[15pt] font-bold">العرض الفني</h2>
        {proposal.sections.map((section, index) => (
          <div key={index} className="mt-5 break-inside-avoid">
            <h3 className="font-heading text-[12.5pt] font-bold">
              {index + 1}. {section.title}
            </h3>
            <Body text={section.body} />
          </div>
        ))}

        {proposal.timeline.length > 0 ? (
          <div className="mt-6 break-inside-avoid">
            <h3 className="font-heading text-[12.5pt] font-bold">الجدول الزمني المقترح</h3>
            <table className="mt-2 w-full border-collapse text-[10.5pt]">
              <thead>
                <tr>
                  <th className={th}>المرحلة</th>
                  <th className={th}>المدة</th>
                  <th className={th}>تنتهي بنهاية الأسبوع</th>
                </tr>
              </thead>
              <tbody>
                {proposal.timeline.map((phase, index) => (
                  <tr key={index}>
                    <td className={td}>{phase.title}</td>
                    <td className={td}>{phase.weeks} أسبوع</td>
                    <td className={`${td} font-mono`} dir="ltr">
                      <span className="block text-start">{weekEnds[index]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10pt] text-neutral-600">إجمالي المدة التقديرية: {totalWeeks} أسبوع من تاريخ بدء العمل.</p>
          </div>
        ) : null}
      </section>

      <section className="mt-10 break-before-page">
        <h2 className="border-s-4 border-primary-500 ps-3 font-heading text-[15pt] font-bold">العرض المالي</h2>
        <table className="mt-4 w-full border-collapse text-[10.5pt]">
          <thead>
            <tr>
              <th className={th}>#</th>
              <th className={th}>البند</th>
              <th className={th}>الكمية</th>
              <th className={th}>سعر الوحدة</th>
              <th className={th}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {proposal.items.map((item, index) => (
              <tr key={index} className="break-inside-avoid">
                <td className={`${td} font-mono`}>{index + 1}</td>
                <td className={td}>
                  <p className="font-semibold">{item.title}</p>
                  {item.description ? <p className="text-[10pt] leading-6 text-neutral-600">{item.description}</p> : null}
                </td>
                <td className={`${td} font-mono`}>{item.quantity}</td>
                <td className={`${td} whitespace-nowrap`}>{money(item.unitPriceMinor)}</td>
                <td className={`${td} whitespace-nowrap font-semibold`}>{money(item.quantity * item.unitPriceMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 ms-auto grid w-full max-w-[85mm] gap-1.5 text-[11pt]">
          <div className="flex justify-between"><dt>الإجمالي قبل الخصم</dt><dd>{money(totals.subtotalMinor)}</dd></div>
          {totals.discountMinor > 0 ? <div className="flex justify-between"><dt>الخصم</dt><dd><bdi dir="ltr">- {money(totals.discountMinor)}</bdi></dd></div> : null}
          {proposal.taxRateBp !== null ? <div className="flex justify-between"><dt>الضريبة (<bdi>{formatPercentBp(proposal.taxRateBp)}</bdi>)</dt><dd>{money(totals.taxMinor)}</dd></div> : null}
          <div className="mt-1 flex justify-between rounded-lg bg-secondary-900 px-3 py-2.5 text-[12.5pt] font-bold text-white"><dt>الإجمالي المستحق</dt><dd>{money(totals.totalMinor)}</dd></div>
        </dl>

        <div className="mt-8 break-inside-avoid">
          <h3 className="font-heading text-[12.5pt] font-bold">جدول الدفعات</h3>
          <table className="mt-2 w-full border-collapse text-[10.5pt]">
            <thead>
              <tr>
                <th className={th}>الدفعة</th>
                <th className={th}>النسبة</th>
                <th className={th}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {proposal.milestones.map((milestone, index) => (
                <tr key={index}>
                  <td className={td}>{milestone.title}</td>
                  <td className={`${td} font-mono`} dir="ltr"><span className="block text-start">{formatPercentBp(milestone.percentBp)}</span></td>
                  <td className={`${td} whitespace-nowrap font-semibold`}>{money(payments[index] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-[10pt] leading-7 text-neutral-600">
          {proposal.validUntil ? `هذا العرض ساري حتى ${formatDateLong(proposal.validUntil)}. ` : ""}
          الأسعار بعملة: {proposal.currency}
          {proposal.taxRateBp === null ? " ولا تشمل أي ضرائب إلا إذا ذُكر خلاف ذلك." : "."}
        </p>
      </section>
    </div>
  );
}
