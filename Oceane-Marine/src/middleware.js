import { NextResponse } from "next/server";

/**
 * API routes that stay reachable without a session cookie.
 * Everything under /api/* else requires access_token (see matcher).
 */

/**
 * Anonymous “Google Forms”-style submissions from the QHSE-FORMS app (or any
 * external caller). Those users never have an Oceane `access_token` cookie.
 * Keep in sync with `QHSE-FORMS/src/lib/qhseFormConfig.js` `createPath` values
 * (+ near-miss). New public form → add full path here.
 */
const PUBLIC_EXTERNAL_FORM_POST_ROUTES = new Set([
  "/api/near-miss-form/create",
  "/api/qhse/due-diligence/audit-sub-contractor/create",
  "/api/qhse/form-checklist/hse-induction-checklist/create",
  "/api/qhse/cross-competency/create",
  "/api/qhse/due-diligence/due-diligence-questionnaire/create",
  "/api/qhse/form-checklist/transfer-audit/create",
]);

/**
 * STS checklist external app (`operations-sts-checklist`): anonymous create/read/update.
 * DELETE stays session-only (see `…/[formPath]/[id]/delete`).
 *
 * Public (no `access_token`):
 * - POST `…/{form}/create`
 * - GET/PUT `…/{form}` (?operationRef=…)
 * - GET/PUT `…/{form}/{id}` (document by id)
 * - PUT `…/{form}/{id}/update`
 *
 * Still require login:
 * - Any path ending in `/delete`
 * - `…/{form}/list` (admin listing)
 */
function isPublicOperationsStsChecklistRoute(pathname) {
  if (!pathname.startsWith("/api/operations/sts-checklist/")) return false;
  if (pathname.endsWith("/delete")) {
    return false;
  }
  if (pathname.endsWith("/create")) {
    return /^\/api\/operations\/sts-checklist\/[^/]+\/create$/.test(pathname);
  }
  if (pathname.endsWith("/update")) {
    return /^\/api\/operations\/sts-checklist\/[^/]+\/[^/]+\/update$/.test(pathname);
  }
  const twoAfterBase =
    /^\/api\/operations\/sts-checklist\/([^/]+)\/([^/]+)$/.exec(pathname);
  if (twoAfterBase) {
    const second = twoAfterBase[2];
    if (second === "list") {
      return false;
    }
    return true;
  }
  return /^\/api\/operations\/sts-checklist\/[^/]+$/.test(pathname);
}

function isPublicApiRoute(pathname) {
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/signup" ||
    pathname === "/api/auth/logout"
  ) {
    return true;
  }
  if (PUBLIC_EXTERNAL_FORM_POST_ROUTES.has(pathname)) {
    return true;
  }
  if (isPublicOperationsStsChecklistRoute(pathname)) {
    return true;
  }
  // Cron handlers validate CRON_SECRET (or dev rules) themselves
  if (pathname.startsWith("/api/cron/")) {
    return true;
  }
  // CORS proxy for embedded / external callers — handlers forward to internal APIs
  if (pathname.startsWith("/api/sts-proxy/")) {
    return true;
  }
  return false;
}

export function middleware(request) {
  const token = request.cookies.get("access_token")?.value;
  const { pathname } = request.nextUrl;

  // Never block CORS preflight
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  /* ==========================
     1️⃣ Authenticated API routes
  ========================== */
  if (pathname.startsWith("/api/")) {
    if (isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const publicPages = ["/login", "/signup"];

  if (publicPages.includes(pathname)) {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  /* ==========================
     2️⃣ Protected pages (session required)
  ========================== */
  const protectedRoutes = [
    "/dashboard",
    "/operations",
    "/pms",
    "/qhse",
    "/accounts",
    "/hr",
    "/admin",
  ];

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/operations/:path*",
    "/pms/:path*",
    "/qhse/:path*",
    "/accounts/:path*",
    "/hr/:path*",
    "/admin",
    "/admin/:path*",
    "/login",
    // "/signup",
    "/api/:path*",
  ],
};
