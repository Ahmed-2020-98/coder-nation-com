import "server-only";
import { access } from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { appUrl, chromePath, isProduction } from "./env";

export class PdfError extends Error {}

// Chrome is heavy: one render at a time, the rest wait their turn.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Prints /proposals/:id/print with headless Chrome. The page needs the caller's session, so the cookie is handed to
 * the browser; it only ever visits this app's own URL (APP_URL), never anything derived from a request.
 */
export function renderProposalPdf(proposalId: string, sessionToken: string, number: string): Promise<Buffer> {
  const run = queue.then(() => render(proposalId, sessionToken, number));
  queue = run.catch(() => undefined);
  return run;
}

async function render(proposalId: string, sessionToken: string, number: string): Promise<Buffer> {
  const executablePath = chromePath();
  if (executablePath.startsWith("/")) {
    try {
      await access(executablePath);
    } catch {
      throw new PdfError("Chrome مش موجود. نزّله أو حدد مساره في CHROME_PATH.");
    }
  }
  const base = appUrl();
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--font-render-hinting=none"], timeout: 30_000 }).catch((error: unknown) => {
    throw new PdfError(`تعذّر تشغيل Chrome: ${error instanceof Error ? error.message.slice(0, 160) : "خطأ غير معروف"}`);
  });
  try {
    const page = await browser.newPage();
    await page.setCookie({ name: SESSION_COOKIE, value: sessionToken, url: base, httpOnly: true, secure: isProduction && base.startsWith("https") });
    const response = await page.goto(`${base}/proposals/${encodeURIComponent(proposalId)}/print`, { waitUntil: "networkidle0", timeout: 30_000 });
    if (!response?.ok() || new URL(page.url()).pathname.startsWith("/login")) throw new PdfError("تعذّر فتح صفحة الطباعة (الجلسة أو العرض).");
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:9px;color:#6b7280;padding:0 15mm;display:flex;justify-content:space-between;direction:ltr"><span>${number}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: "16mm", bottom: "18mm", left: "0", right: "0" },
      timeout: 30_000,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
