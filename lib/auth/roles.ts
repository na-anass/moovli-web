export interface EntityMembership {
  entityId: string;
  entityName: string;
  role: "owner" | "manager" | "staff";
  /** ISO timestamp when the studio finished the onboarding wizard; null = not yet onboarded. */
  onboardedAt: string | null;
  /** ISO 4217 currency code for the studio's display currency (default "MAD"). */
  currencyCode: string;
}

export interface InstructorMembership {
  providerId: string;
  entityId: string;
  entityName: string;
}

export interface UserRoles {
  isAdmin: boolean;
  ownedEntities: EntityMembership[];
  instructorEntities: InstructorMembership[];
}

/** Raw shape of the /api/me payload (only the fields we map). */
interface MeResponse {
  isAdmin?: boolean;
  ownedEntities?: Array<{
    entityId?: string;
    entity_id?: string;
    role: EntityMembership["role"];
    entity?: { name?: string; onboarded_at?: string | null; currency_code?: string };
  }>;
  instructorEntities?: Array<{
    id: string;
    primary_entity_id?: string;
    entity?: { id?: string; name?: string };
  }>;
}

/** Thrown when /api/me can't be reached / doesn't answer 2xx after retries. */
export class RolesFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RolesFetchError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch user roles via the moovli-api (which uses supabaseAdmin, bypassing RLS).
 * This avoids RLS issues with direct browser Supabase queries on entity_owners.
 *
 * Resilience: right after sign-in the fresh token / auth cookies can lag by a
 * few hundred ms, so the first /api/me call may transiently fail. We RETRY a
 * few times and only THROW on persistent failure. Crucially we never return an
 * empty roles object on a transport failure — an empty result must mean the API
 * genuinely reported no roles (a 200 with empty arrays), otherwise callers would
 * mistake a hiccup for "no access" and bounce the user to /no-access.
 */
export async function getUserRoles(accessToken: string): Promise<UserRoles> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const MAX_ATTEMPTS = 3;
  let lastDetail = "network";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${apiUrl}/api/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      if (res.ok) {
        const me = (await res.json()) as { data?: MeResponse };
        const data = me.data || {};

        const ownedEntities: EntityMembership[] = (data.ownedEntities || []).map((row) => ({
          entityId: (row.entityId || row.entity_id) as string,
          entityName: row.entity?.name || "Studio",
          role: row.role,
          onboardedAt: row.entity?.onboarded_at ?? null,
          currencyCode: row.entity?.currency_code ?? "MAD",
        }));

        const instructorEntities: InstructorMembership[] = (data.instructorEntities || []).map(
          (row) => ({
            providerId: row.id,
            entityId: (row.primary_entity_id || row.entity?.id) as string,
            entityName: row.entity?.name || "Studio",
          }),
        );

        return { isAdmin: !!data.isAdmin, ownedEntities, instructorEntities };
      }

      lastDetail = `HTTP ${res.status}`;
      // Auth failures won't recover with the same token — stop retrying early.
      if (res.status === 401 || res.status === 403) break;
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : "fetch failed";
    }

    if (attempt < MAX_ATTEMPTS - 1) await sleep(250 * (attempt + 1));
  }

  throw new RolesFetchError(`Failed to fetch user roles (${lastDetail})`);
}

/** Determine the best default redirect for a user based on their roles */
export function getDefaultRedirect(roles: UserRoles): string {
  if (roles.isAdmin) return "/admin/dashboard";
  if (roles.ownedEntities.length > 0) {
    // Brand-new studios (never finished the wizard) go straight to onboarding —
    // skipping a flash of the dashboard before the client-side gate bounces them.
    if (roles.ownedEntities[0].onboardedAt === null) return "/studio/onboarding";
    return "/studio/dashboard";
  }
  if (roles.instructorEntities.length > 0) return "/instructor/dashboard";
  return "/no-access";
}
