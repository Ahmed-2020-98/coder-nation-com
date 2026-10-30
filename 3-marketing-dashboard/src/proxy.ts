import { NextResponse, type NextRequest } from "next/server";
import { isLocalHost } from "@/lib/host";

/**
 * Local-only gate for pages and API routes: refuses any request whose Host header isn't localhost / 127.0.0.1
 * (blocks LAN access and DNS-rebinding). The same check also runs inside every API handler (server/http.ts), which
 * is what protects the two upload routes below: Next buffers request bodies that pass through the proxy (10 MB cap
 * by default), so large uploads are excluded here and guarded in their own handlers instead.
 */
export function proxy(request: NextRequest) {
  if (!isLocalHost(request.headers.get("host"))) {
    return new NextResponse("الـ Dashboard متاح محليًا فقط", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/filming/[^/]+/footage|api/research/upload).*)"],
};
