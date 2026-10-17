import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap edge check only: sends visitors without a session cookie to /login.
 * Real authentication and authorization happen server-side in layouts and API routes.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("__Host-integris_session") || request.cookies.has("integris_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
