// Employee contracts: vocabulary, the tokens a clause may hold, and what must be filled before a contract is sent.
// Safe to import from browser code.
import { WEEKDAY_LABEL } from "./attendance-rules";
import { formatDateLong } from "./format";
import { formatMoney } from "./money";
import type { Currency } from "./crm-rules";

export const CONTRACT_STATUSES = ["draft", "sent", "accepted", "declined"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = { draft: "مسودة", sent: "مستني موافقة الموظف", accepted: "موافَق عليه", declined: "مرفوض" };

export type Clause = { title: string; body: string };

/** The fields a clause's tokens are filled from. */
export type ContractFacts = {
  employeeName: string;
  jobTitle: string;
  startDate: string | null;
  workStart: string;
  workEnd: string;
  workDays: number[];
  salaryMinor: number | null;
  currency: Currency;
  commission: string;
};

/** "09:00" -> "9:00 صباحًا", "17:30" -> "5:30 مساءً": how a person reads a shift, Western digits. */
export function formatClock(time: string): string {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "صباحًا" : "مساءً"}`;
}

/** Sunday-first list of day names, e.g. "الأحد، الاثنين، الثلاثاء". */
export const formatWorkDays = (days: readonly number[]): string => [...days].sort((a, b) => a - b).map((d) => WEEKDAY_LABEL[d]).join("، ");

// The amount is wrapped in a left-to-right isolate (U+2066 ... U+2069): inside Arabic text "8,000.00 EGP" would
// otherwise be shown as "EGP 8,000.00". It works in plain strings too, so a clause's {المرتب} gets it as well.
export const formatSalary = (facts: Pick<ContractFacts, "salaryMinor" | "currency">): string =>
  facts.salaryMinor === null ? "" : `⁦${formatMoney(facts.salaryMinor, facts.currency)}⁩ شهريًا`;

/** Every token a clause may use, with what it becomes. Shown in the editor as a cheat sheet. */
export const TOKENS: Token<ContractFacts>[] = [
  { token: "{اسم_الموظف}", label: "اسم الموظف", value: (f) => f.employeeName },
  { token: "{المسمى_الوظيفي}", label: "المسمى الوظيفي", value: (f) => f.jobTitle },
  { token: "{تاريخ_البدء}", label: "تاريخ البدء", value: (f) => (f.startDate ? formatDateLong(f.startDate) : "") },
  { token: "{بداية_العمل}", label: "بداية الدوام", value: (f) => formatClock(f.workStart) },
  { token: "{نهاية_العمل}", label: "نهاية الدوام", value: (f) => formatClock(f.workEnd) },
  { token: "{أيام_العمل}", label: "أيام العمل", value: (f) => formatWorkDays(f.workDays) },
  { token: "{المرتب}", label: "المرتب", value: formatSalary },
  { token: "{العمولة}", label: "العمولة", value: (f) => f.commission },
];

export type Token<F> = { token: string; label: string; value: (f: F) => string };

/** `text` with every token of `tokens` filled in. An unknown token is left as it is, so a typo shows up instead of vanishing. */
export function fillWith<F>(text: string, tokens: readonly Token<F>[], facts: F): string {
  return tokens.reduce((out, { token, value }) => out.split(token).join(value(facts)), text);
}

/** The first token a clause uses whose value is still empty (it would print a hole in the contract), if any. */
export function emptyToken<F>(clauses: readonly Clause[], tokens: readonly Token<F>[], facts: F): { clause: Clause; label: string } | null {
  for (const clause of clauses) {
    const empty = tokens.find(({ token, value }) => clause.body.includes(token) && !value(facts).trim());
    if (empty) return { clause, label: empty.label };
  }
  return null;
}

/** A clause body with its tokens filled in. */
export const fillTokens = (text: string, facts: ContractFacts): string => fillWith(text, TOKENS, facts);

/** What still stops a contract from being sent, in the order a person would fix it. Empty = ready. */
export function contractProblems(c: ContractFacts & { clauses: readonly Clause[] }): string[] {
  const problems: string[] = [];
  if (c.employeeName.trim().length < 2) problems.push("اكتب اسم الموظف");
  if (!c.jobTitle.trim()) problems.push("اكتب المسمى الوظيفي");
  if (!c.startDate) problems.push("حدد تاريخ البدء");
  if (c.workDays.length === 0) problems.push("اختار أيام العمل");
  if (c.salaryMinor === null && !c.commission.trim()) problems.push("حدد المقابل المادي (مرتب أو عمولة)");
  if (c.clauses.length === 0) problems.push("العقد لازم يبقى فيه بند واحد على الأقل");
  // e.g. {المرتب} with no salary.
  const empty = emptyToken(c.clauses, TOKENS, c);
  if (empty) problems.push(`البند «${empty.clause.title}» بيستخدم ${empty.label} وهو لسه فاضي`);
  return problems;
}
