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

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Get auth token from Supabase cookie via browser client
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
      ...options.headers,
    },
  });

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
