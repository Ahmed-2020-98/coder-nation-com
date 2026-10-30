// Money arithmetic for proposals. Amounts are integers in the currency's smallest unit (all five supported
// currencies have 2 decimals), so nothing here ever touches a float except for display.
import { CURRENCIES, type Currency } from "./crm-rules";

export type LineItem = { quantity: number; unitPriceMinor: number };
export type Totals = { subtotalMinor: number; discountMinor: number; taxableMinor: number; taxMinor: number; totalMinor: number };

/** Percent of an integer amount, rounded half up, in BigInt so large amounts can't lose precision. */
export function percentOf(amountMinor: number, basisPoints: number): number {
  const product = BigInt(amountMinor) * BigInt(basisPoints);
  return Number((product + BigInt(5000)) / BigInt(10000));
}

/** Subtotal - discount (never more than the subtotal) + tax on what is left. `taxRateBp` null = no tax line. */
export function computeTotals(items: readonly LineItem[], discountMinor: number, taxRateBp: number | null): Totals {
  const subtotalMinor = items.reduce((sum, item) => sum + item.quantity * item.unitPriceMinor, 0);
  const discount = Math.min(Math.max(0, discountMinor), subtotalMinor);
  const taxableMinor = subtotalMinor - discount;
  const taxMinor = taxRateBp === null ? 0 : percentOf(taxableMinor, taxRateBp);
  return { subtotalMinor, discountMinor: discount, taxableMinor, taxMinor, totalMinor: taxableMinor + taxMinor };
}

/** Payment schedule: each milestone's share of the total, with the rounding remainder on the last one so they sum exactly. */
export function splitPayments(totalMinor: number, percentsBp: readonly number[]): number[] {
  const amounts = percentsBp.map((bp) => percentOf(totalMinor, bp));
  const drift = totalMinor - amounts.reduce((sum, amount) => sum + amount, 0);
  if (amounts.length > 0) amounts[amounts.length - 1] += drift;
  return amounts;
}

export const milestonesAreComplete = (percentsBp: readonly number[]): boolean =>
  percentsBp.length > 0 && percentsBp.reduce((sum, bp) => sum + bp, 0) === 10000;

/** "1,500.50" / "١٥٠٠٫٥٠" -> 150050. null when it isn't a valid non-negative amount with at most 2 decimals. */
export function parseMoney(input: string): number | null {
  const ascii = input
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٫]/g, ".")
    .replace(/[,٬\s]/g, "");
  const match = ascii.match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
}

/** Plain decimal text for an input box: 150050 -> "1500.50". */
export function toDecimalText(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const cents = String(minor % 100).padStart(2, "0");
  return cents === "00" ? String(whole) : `${whole}.${cents}`;
}

const AMOUNT = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1,500.50 EGP": Western digits and the ISO code, which can't be misread the way a local symbol ("E£", "£") can. */
export function formatMoney(minor: number, currency: Currency): string {
  return `${AMOUNT.format(minor / 100)} ${currency}`;
}

export const isCurrency = (value: unknown): value is Currency => typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);

/** 1400 -> "14%", 1250 -> "12.5%". */
export const formatPercentBp = (bp: number): string => `${Number.isInteger(bp / 100) ? bp / 100 : (bp / 100).toFixed(2).replace(/0+$/, "")}%`;
