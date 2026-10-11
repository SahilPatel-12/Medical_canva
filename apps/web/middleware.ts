import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // In a tab-isolated architecture, each browser tab maintains its own authenticated
  // identity via sessionStorage and tab-scoped client instances.
  // Next.js top-level HTTP requests do not carry tab-isolated storage, so client-side
  // route guards in AuthProvider, FilesDashboard, and EditorView perform the authoritative
  // session checks. Middleware allows shell delivery without cross-tab cookie collision.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/files/:path*",
    "/editor/:path*",
    "/login",
    "/signup",
  ],
};
