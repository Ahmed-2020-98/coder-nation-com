import { getClientContract } from "@/server/client-contracts";
import { PdfError, renderClientContractPdf } from "@/server/pdf";
import { currentToken, requirePermission } from "@/server/session";

// Starting Chromium and printing takes a few seconds; the default limit is too tight for a cold start.
export const maxDuration = 60;

const text = (status: number, message: string) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** The client contract as a PDF (owners and managers). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("client_contract.manage");
  const { id } = await params;
  const record = await getClientContract(id);
  if (!record) return text(404, "العقد مش موجود");
  const token = await currentToken();
  if (!token) return text(401, "الجلسة انتهت");
  try {
    const pdf = await renderClientContractPdf(id, token, record.number);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${record.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[pdf]", error instanceof Error ? error.message : error);
    return text(error instanceof PdfError ? 503 : 500, error instanceof PdfError ? error.message : "تعذّر إنشاء الـ PDF");
  }
}
