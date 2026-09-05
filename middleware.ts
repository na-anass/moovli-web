import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/set-password", "/auth/callback"];

/**
 * Public routes served without auth — used by the consumer-facing booking site
 * (Spec C). Includes:
 *   /booking/<studio-slug>           — direct hosted page
 *   /c/<custom-link-slug>            — custom calendar link
 *   /embed/<embed-slug>              — embeddable widget iframe target
 *   /t/<qr-code>                     — guest booking ticket (QR landing)
 */
const PUBLIC_PATH_PREFIXES = ["/booking/", "/c/", "/embed/", "/t/"];

/**
 * On `booking.*` subdomain, rewrite the path so it lands in the public routes.
 * E.g. booking.moovli.app/yoga-sara → /booking/yoga-sara
 *      booking.moovli.app/c/marina  → /c/marina (already prefixed)
 */
const rewriteBookingSubdomain = (request: NextRequest): NextResponse | null => {
  const host = request.headers.get("host") ?? "";
  const isBookingSubdomain = host.startsWith("booking.");
  if (!isBookingSubdomain) return null;

  const { pathname } = request.nextUrl;
  // If path already starts with a public prefix, leave it alone
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  // Otherwise treat the whole path as a studio slug and rewrite into /booking/<slug>
  const url = request.nextUrl.clone();
  url.pathname = `/booking${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Subdomain rewrite first
  const rewritten = rewriteBookingSubdomain(request);
  if (rewritten) return rewritten;

  // Public booking routes skip auth entirely
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Create supabase client with cookie handling
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Create a new response with updated cookies
          response = NextResponse.next({ request });
          // Set cookies on the response (for the browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this is critical for keeping cookies alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Seed the UI locale cookie from the user's saved preference on first visit
  // (only when the cookie is absent, so an explicit in-app switch always wins).
  if (user && !request.cookies.get("NEXT_LOCALE")) {
    const { data: profile } = await supabase
      .from("users")
      .select("preferred_language")
      .eq("id", user.id)
      .single();
    const pref = profile?.preferred_language;
    const locale = pref === "fr" ? "fr" : "en";
    request.cookies.set("NEXT_LOCALE", locale);
    response.cookies.set("NEXT_LOCALE", locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    if (user && pathname.startsWith("/login")) {
      // Logged in user visiting login — redirect to home
      const url = request.nextUrl.clone();
      url.pathname = "/";
      // Copy cookies to redirect response
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    }
    return response;
  }

  // Not logged in — redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    const redirectResponse = NextResponse.redirect(url);
    // Copy any session cookies to the redirect
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Authenticated — return response with refreshed session cookies
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|img/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
