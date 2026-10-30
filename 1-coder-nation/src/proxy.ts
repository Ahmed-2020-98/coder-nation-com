import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * A fast, optimistic gate for /admin: no session cookie means a real 307 to the login page, so a stranger never even
 * gets the panel's streamed shell. It cannot check the session itself (that needs the database), so it is NOT the
 * security boundary: every admin page, action and route handler still calls requireAdmin().
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
