import { getContract } from "@/server/contracts";
import { PdfError, renderContractPdf } from "@/server/pdf";
import { canAccessContract } from "@/server/permissions";
import { currentToken, requirePermission } from "@/server/session";

// Starting Chromium and printing takes a few seconds; the default limit is too tight for a cold start.
export const maxDuration = 60;

const text = (status: number, message: string) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** The contract as a PDF, for the owner and for the employee it was sent to (never anyone else's, never a draft to them). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("contract.respond");
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract || !canAccessContract(user, contract)) return text(404, "العقد مش موجود");
  const token = await currentToken();
  if (!token) return text(401, "الجلسة انتهت");
  try {
    const pdf = await renderContractPdf(id, token, contract.number);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${contract.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[pdf]", error instanceof Error ? error.message : error);
    return text(error instanceof PdfError ? 503 : 500, error instanceof PdfError ? error.message : "تعذّر إنشاء الـ PDF");
  }
}
