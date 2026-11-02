import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * A fast, optimistic gate: no session cookie means a real 307 to the login page, so a stranger never gets even
 * the shell of an internal page. It cannot check the session (that needs the database), so it is NOT the security
 * boundary: every page, action and route handler still calls requireUser()/requirePermission().
 * Open on purpose: the login page, the website's signed intake endpoint (it authenticates itself with an HMAC) and the
 * MCP endpoint (it authenticates itself with an API key).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/intake/website" || pathname === "/api/mcp") return NextResponse.next();
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
