import "server-only";

/** A short plain-text answer for the PDF links (shown as-is by the browser). */
export const text = (status: number, message: string) => new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * The PDF links pass their checks, then hand over to the print page: the viewer's browser makes the PDF.
 * (Chrome on the server took the whole app down on shared hosting.) `path` is always a fixed print route with an encoded id.
 */
export const toPrintPage = (path: string) => new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
