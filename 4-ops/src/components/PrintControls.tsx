"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Printer } from "lucide-react";

/** Opens the print dialog once the fonts are in (so the PDF never falls back to a system font), plus a bar to do it again. Never printed. */
export function PrintControls({ back }: { back: string }) {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    document.fonts.ready.then(() => window.print());
  }, []);

  return (
    // Hidden from the printout by PrintSheet's own @media print rule.
    <div data-print-hide="" className="sticky top-0 z-10 mb-6 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={back} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold text-ink-muted hover:text-ink">
          <ArrowRight aria-hidden="true" className="size-4" />
          رجوع
        </Link>
        <p className="text-sm text-ink-muted">اختار «Save as PDF» من نافذة الطباعة</p>
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary-500 px-5 font-semibold text-on-primary shadow-xs hover:bg-primary-400">
          <Printer aria-hidden="true" className="size-4" />
          حفظ PDF
        </button>
      </div>
    </div>
  );
}
