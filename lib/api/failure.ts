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

/**
 * Record the technical detail. The browser console is all we have today —
 * moovli-web has no error reporting (mobile uses Sentry, web nothing), so this
 * is the hook to replace when one is added.
 */
export function logFailure(context: string, error: unknown): void {
  const detail =
    error instanceof ApiRequestError
      ? { status: error.status, code: error.code, message: error.message, details: error.details }
      : { message: error instanceof Error ? error.message : String(error) };

  console.error(`[${context}] request failed`, {
    ...detail,
    kind: classifyFailure(error),
    at: new Date().toISOString(),
  });
}
