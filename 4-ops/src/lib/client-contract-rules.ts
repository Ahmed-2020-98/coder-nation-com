// Client contracts and invoices: vocabulary, the tokens a clause may hold, what must be done before a contract is
// ready to sign, and the paid / remaining arithmetic. Safe to import from browser code.
import { emptyToken, fillWith, type Clause, type Token } from "./contract-rules";
import type { Currency } from "./crm-rules";
import { formatDateLong } from "./format";
import { formatMoney } from "./money";
import { PLACEHOLDER_RE } from "./proposal-rules";

export const CLIENT_CONTRACT_STATUSES = ["draft", "ready", "signed", "cancelled"] as const;
export type ClientContractStatus = (typeof CLIENT_CONTRACT_STATUSES)[number];
export const CLIENT_CONTRACT_STATUS_LABEL: Record<ClientContractStatus, string> = { draft: "مسودة", ready: "جاهز للتوقيع", signed: "موقّع", cancelled: "ملغي" };

/** Payments are recorded once the contract is final (ready or signed), never on a draft or a cancelled one. */
export const takesPayments = (status: ClientContractStatus): boolean => status === "ready" || status === "signed";

export const PAYMENT_METHODS = ["bank_transfer", "instapay", "wallet", "cash", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "تحويل بنكي",
  instapay: "InstaPay",
  wallet: "محفظة إلكترونية",
  cash: "كاش",
  card: "بطاقة",
  other: "أخرى",
};

export const INVOICE_STATUSES = ["issued", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = { issued: "سارية", void: "ملغاة" };

/** An amount inside Arabic text, in a left-to-right isolate so "4,000.00 EGP" isn't shown as "EGP 4,000.00". */
export const formatAmount = (minor: number, currency: Currency): string => `⁦${formatMoney(minor, currency)}⁩`;

/** 1 -> "أسبوع واحد", 2 -> "أسبوعان", 3..10 -> "N أسابيع", 11+ -> "N أسبوعًا". */
export function formatWeeks(weeks: number): string {
  if (weeks <= 0) return "";
  if (weeks === 1) return "أسبوع واحد";
  if (weeks === 2) return "أسبوعان";
  return weeks <= 10 ? `${weeks} أسابيع` : `${weeks} أسبوعًا`;
}

/** The fields a clause's tokens are filled from. */
export type ClientContractFacts = {
  title: string;
  clientName: string;
  companyName: string;
  proposalNumber: string;
  totalMinor: number;
  currency: Currency;
  startDate: string | null;
  timeline: readonly { weeks: number }[];
};

export const totalWeeks = (timeline: readonly { weeks: number }[]): number => timeline.reduce((sum, phase) => sum + phase.weeks, 0);

export const CLIENT_TOKENS: Token<ClientContractFacts>[] = [
  { token: "{عنوان_المشروع}", label: "عنوان العقد", value: (f) => f.title },
  { token: "{اسم_العميل}", label: "اسم العميل", value: (f) => f.clientName },
  { token: "{اسم_الشركة}", label: "اسم شركتنا", value: (f) => f.companyName },
  { token: "{رقم_العرض}", label: "رقم العرض", value: (f) => `⁦${f.proposalNumber}⁩` },
  { token: "{إجمالي_العقد}", label: "إجمالي العقد", value: (f) => formatAmount(f.totalMinor, f.currency) },
  { token: "{تاريخ_البدء}", label: "تاريخ بدء التنفيذ", value: (f) => (f.startDate ? formatDateLong(f.startDate) : "") },
  { token: "{مدة_التنفيذ}", label: "مدة التنفيذ (من الجدول الزمني)", value: (f) => formatWeeks(totalWeeks(f.timeline)) },
];

export const fillClientTokens = (text: string, facts: ClientContractFacts): string => fillWith(text, CLIENT_TOKENS, facts);

/** What still stops a contract from being marked ready to sign, in the order a person would fix it. Empty = ready. */
export function clientContractProblems(c: ClientContractFacts & { clauses: readonly Clause[] }): string[] {
  const problems: string[] = [];
  if (c.title.trim().length < 2) problems.push("اكتب عنوان العقد");
  if (c.clientName.trim().length < 2) problems.push("اكتب اسم العميل");
  if (!c.startDate) problems.push("حدد تاريخ بدء التنفيذ");
  if (c.clauses.length === 0) problems.push("العقد لازم يبقى فيه بند واحد على الأقل");
  const empty = emptyToken(c.clauses, CLIENT_TOKENS, c);
  if (empty) problems.push(`البند «${empty.clause.title}» بيستخدم ${empty.label} وهو لسه فاضي`);
  // A `[...]` gap from the template must never reach a printed contract.
  for (const clause of c.clauses) {
    const gap = `${clause.title}\n${clause.body}`.match(PLACEHOLDER_RE)?.[0];
    if (gap) {
      problems.push(`البند «${clause.title}» فيه فراغ لسه ما اتملاش: ${gap}`);
      break;
    }
  }
  return problems;
}

/** Paid so far (void invoices don't count) and what is left of the contract's total. */
export function paymentSummary(totalMinor: number, invoices: readonly { amountMinor: number; status: InvoiceStatus }[]): { paidMinor: number; remainingMinor: number } {
  const paidMinor = invoices.filter((i) => i.status === "issued").reduce((sum, i) => sum + i.amountMinor, 0);
  return { paidMinor, remainingMinor: Math.max(0, totalMinor - paidMinor) };
}

/** Collected per payment of the schedule (by its position), from the live invoices that name one. */
export function paidPerMilestone(count: number, invoices: readonly { amountMinor: number; status: InvoiceStatus; milestoneIndex: number | null }[]): number[] {
  const paid = Array.from({ length: count }, () => 0);
  for (const invoice of invoices) {
    if (invoice.status === "issued" && invoice.milestoneIndex !== null && invoice.milestoneIndex < count) paid[invoice.milestoneIndex] += invoice.amountMinor;
  }
  return paid;
}
