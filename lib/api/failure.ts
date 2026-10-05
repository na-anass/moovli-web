import { ApiRequestError } from "./client";

/**
 * Turn a thrown request error into something a studio owner can act on.
 *
 * The raw server message ("Invalid or expired token") is for us, not for them:
 * it is English regardless of their language, and it describes a mechanism
 * rather than what they should do. So the UI gets a category, and the detail
 * goes to the console where support can ask for it.
 */
export type FailureKind = "auth" | "offline" | "unavailable" | "denied" | "unknown";

export function classifyFailure(error: unknown): FailureKind {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return "auth";
    if (error.status === 403) return "denied";
    if (error.status === 408 || error.status >= 500) return "unavailable";
    return "unknown";
  }
  // fetch() rejects (rather than resolving with a status) when the request
  // never reached the server: no network, DNS failure, the API not listening.
  if (error instanceof TypeError) return "offline";
  return "unknown";
}

/** i18n key under `shared.errors` for a failure kind. */
export const failureMessageKey = (kind: FailureKind) => `errors.${kind}`;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/**
 * Record the technical detail: the browser console, and the API's log so it
 * exists somewhere we can actually read (`pm2 logs moovli-api | grep CLIENT`).
 *
 * Reporting is fire-and-forget and never throws: a failed report must not
 * become a second visible failure, and must not recurse — note this sends with
 * plain fetch rather than apiClient, which would classify and report again.
 */
export function logFailure(
  context: string,
  error: unknown,
  meta: { path?: string; entityId?: string } = {},
): void {
  const kind = classifyFailure(error);
  const detail =
    error instanceof ApiRequestError
      ? { status: error.status, code: error.code, message: error.message, details: error.details }
      : { message: error instanceof Error ? error.message : String(error) };

  console.error(`[${context}] request failed`, { ...detail, kind, at: new Date().toISOString() });

  // "offline" means the network is gone — a report would fail too.
  if (kind === "offline" || typeof window === "undefined") return;

  void (async () => {
    // Attach the token when we can, so the report names a user. The endpoint
    // uses optionalAuth, which ignores an invalid token rather than rejecting —
    // so an expired session (the very thing worth reporting) still gets through.
    let token: string | undefined;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().auth.getSession();
      token = data.session?.access_token;
    } catch {
      /* no session to attach — report anonymously */
    }

    await fetch(`${API_URL}/api/client-errors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      keepalive: true, // survives the user navigating away mid-report
      body: JSON.stringify({
        context,
        kind,
        status: error instanceof ApiRequestError ? error.status : undefined,
        code: error instanceof ApiRequestError ? error.code : undefined,
        message: detail.message?.slice(0, 500),
        path: meta.path,
        entityId: meta.entityId,
      }),
    });
  })().catch(() => {
    /* reporting is best-effort — swallow, never recurse */
  });
}
