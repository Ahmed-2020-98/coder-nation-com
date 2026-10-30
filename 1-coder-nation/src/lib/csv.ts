/**
 * One CSV cell. Cells that start with = + - @ (or a tab/CR) are prefixed with an apostrophe: spreadsheets would
 * otherwise run them as formulas, and these cells are text typed by strangers on the internet.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 with a BOM so Excel opens Arabic correctly; CRLF line endings. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
