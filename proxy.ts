import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthPassword,
  isUnsafeCrossSiteRequest,
  verifyAuthToken,
} from "@/lib/web-auth";
import { safeLoginDestination } from "@/lib/login-destination";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/web-auth/login",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.ico",
  "/apple-touch-icon.png",
]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/icons/");
}

function secureResponse(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}

function apiUnauthorized(): NextResponse {
  return secureResponse(NextResponse.json(
    { error: "Authentication required" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": 'Cookie realm="Pi Web"',
      },
    },
  ));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const password = getAuthPassword();
  const publicPath = isPublicPath(pathname);
  const authenticated = password
    ? verifyAuthToken(request.cookies.get(AUTH_COOKIE_NAME)?.value, password)
    : true;

  if (isUnsafeCrossSiteRequest(request)) {
    return secureResponse(NextResponse.json(
      { error: "Cross-site request rejected" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    ));
  }

  if (!authenticated && !publicPath) {
    if (pathname.startsWith("/api/")) return apiUnauthorized();

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Same policy the login page applies to the value it reads back: a leading
    // "/" does not prove the target is local, so let the URL parser decide.
    const returnTo = safeLoginDestination(`${pathname}${search}`, request.nextUrl.origin);
    if (returnTo !== "/") {
      loginUrl.searchParams.set("returnTo", returnTo);
    }
    return secureResponse(NextResponse.redirect(loginUrl));
  }

  if (authenticated && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return secureResponse(NextResponse.redirect(homeUrl));
  }

  const response = secureResponse(NextResponse.next());
  if (!publicPath) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
