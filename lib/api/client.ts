import type {
  CapabilityKey,
  CapabilityKind,
} from "@/lib/entitlements/capabilities";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/**
 * An API error that keeps the server's structured payload.
 *
 * Still a plain `Error` whose `message` is the server message, so every
 * existing `catch (e) { e.message }` keeps working — but `code` and `details`
 * are now available for callers that want to react to WHY a request failed
 * (notably plan gating, which needs the capability and the limit).
 */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    /** The server's `error` field, e.g. "EntitlementRequired". */
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** Why the API refused a plan-gated action. Mirrors EntitlementError in moovli-api. */
export interface EntitlementErrorDetails {
  capability: CapabilityKey;
  kind: CapabilityKind;
  reason: "not_in_plan" | "limit_reached" | "no_subscription";
  limit?: number;
  current?: number;
  planSlug: string | null;
  planName: string | null;
  upgradeUrl?: string;
}

/**
 * True when a request failed because the studio's plan doesn't allow it.
 * Pair with `useEntitlementErrorHandler()` to show the shared upgrade prompt.
 */
export function isEntitlementError(
  error: unknown,
): error is ApiRequestError & { details: EntitlementErrorDetails } {
  return (
    error instanceof ApiRequestError &&
    error.code === "EntitlementRequired" &&
    !!error.details &&
    typeof (error.details as EntitlementErrorDetails).capability === "string"
  );
}

/** Transient server-side failures: the API restarting (deploys) or a proxy blip. */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

const isReadOnly = (options: RequestInit) => {
  const method = (options.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call moovli-api with the current Supabase access token.
 *
 * Two recoveries, because their absence was indistinguishable from "you have no
 * data": pages catch the error and render an empty state, so a studio with 400
 * sessions saw a blank planning page whenever a request failed.
 *
 *  - 401 → refresh the session once and retry. A stale access token on a tab
 *    that has been open a while is the common case.
 *  - network error / 502-504 → retry once. The API restarts on every deploy,
 *    and whoever was mid-request got an empty screen.
 *
 * Only GET/HEAD are retried: replaying a POST could create a second booking.
 */
export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();

  const send = async (token: string | undefined) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

  const { data: { session } } = await supabase.auth.getSession();
  let token = session?.access_token;

  let res: Response;
  try {
    res = await send(token);
  } catch (networkError) {
    if (!isReadOnly(options)) throw networkError;
    await sleep(400);
    res = await send(token);
  }

  // A stale token looks exactly like "no access" to the caller — refresh once.
  if (res.status === 401) {
    const { data } = await supabase.auth.refreshSession();
    const refreshed = data.session?.access_token;
    if (refreshed && refreshed !== token) {
      token = refreshed;
      res = await send(token);
    }
  }

  if (RETRYABLE_STATUSES.has(res.status) && isReadOnly(options)) {
    await sleep(400);
    res = await send(token);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiRequestError(
      res.status,
      error.message || `API error: ${res.status}`,
      error.error,
      error.details,
    );
  }

  return res.json();
}
