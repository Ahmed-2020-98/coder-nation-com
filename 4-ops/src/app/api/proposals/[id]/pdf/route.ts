import { blockingProblems } from "@/lib/proposal-rules";
import { PdfError, renderProposalPdf } from "@/server/pdf";
import { getProposal } from "@/server/proposals";
import { currentToken, requirePermission } from "@/server/session";

// Starting Chromium and printing takes a few seconds; the default limit is too tight for a cold start.
export const maxDuration = 60;

const text = (status: number, message: string) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** The proposal as a PDF, made by headless Chrome from the print page. Same permission as everything else about proposals. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("proposal.export");
  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) return text(404, "العرض مش موجود");
  const problems = blockingProblems(proposal);
  if (problems.length > 0) return text(409, problems[0]);
  const token = await currentToken();
  if (!token) return text(401, "الجلسة انتهت");
  try {
    const pdf = await renderProposalPdf(id, token, proposal.number);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${proposal.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[pdf]", error instanceof Error ? error.message : error);
    return text(error instanceof PdfError ? 503 : 500, error instanceof PdfError ? error.message : "تعذّر إنشاء الـ PDF");
  }
}
