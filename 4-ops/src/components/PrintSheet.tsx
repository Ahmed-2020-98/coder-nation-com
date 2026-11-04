import type { ReactNode } from "react";
import { PrintControls } from "./PrintControls";

// A CSS string literal: the label is a document number we generate, but quote it safely anyway.
const cssString = (value: string) => `"${value.replace(/[\\"]/g, "\\$&").replace(/[\r\n]+/g, " ")}"`;

/**
 * A document on plain white A4 sheets, printed by the viewer's own browser ("Save as PDF").
 * The footer (document number + page x / y) is drawn by @page margin boxes, so it repeats on every printed page.
 */
export function PrintSheet({ label, back, className = "", children }: { label: string; back: string; className?: string; children: ReactNode }) {
  const footer = "font-size: 9px; color: #6b7280; direction: ltr; font-family: system-ui, sans-serif;";
  const css = `
    html, body { background: #fff !important; }
    @media print { [data-print-hide] { display: none !important; } }
    @page {
      size: A4;
      margin: 16mm 0 18mm;
      @bottom-left { content: ${cssString(label)}; ${footer} text-align: left; padding-left: 15mm; }
      @bottom-right { content: counter(page) " / " counter(pages); ${footer} text-align: right; padding-right: 15mm; }
    }`;
  return (
    <>
      <style>{css}</style>
      <PrintControls back={back} />
      <div data-tone="light" className={`mx-auto w-full max-w-[210mm] bg-white px-[15mm] ${className}`}>
        {children}
      </div>
    </>
  );
}
