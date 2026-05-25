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

/**
 * Fetch user roles via the moovli-api (which uses supabaseAdmin, bypassing RLS).
 * This avoids RLS issues with direct browser Supabase queries on entity_owners.
 */
export async function getUserRoles(
  accessToken: string
): Promise<UserRoles> {
  const defaults: UserRoles = {
    isAdmin: false,
    ownedEntities: [],
    instructorEntities: [],
  };

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    // Fetch all role data in parallel from our API
    const [studioRes, instructorRes] = await Promise.all([
      fetch(`${apiUrl}/api/studio/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),

      fetch(`${apiUrl}/api/instructor/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    ]);

    // Check admin by trying admin endpoint
    const adminRes = await fetch(`${apiUrl}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);
    const isAdmin = adminRes?.ok ?? false;

    const ownedEntities: EntityMembership[] = ((studioRes.data as any[]) || []).map(
      (row: any) => ({
        entityId: row.entityId || row.entity_id,
        entityName: row.entity?.name || "Studio",
        role: row.role,
        onboardedAt: row.entity?.onboarded_at ?? null,
        currencyCode: row.entity?.currency_code ?? "MAD",
      })
    );

    const instructorEntities: InstructorMembership[] = ((instructorRes.data as any[]) || []).map(
      (row: any) => ({
        providerId: row.id,
        entityId: row.primary_entity_id || row.entity?.id,
        entityName: row.entity?.name || "Studio",
      })
    );

    return { isAdmin, ownedEntities, instructorEntities };
  } catch (err) {
    console.error("Failed to fetch user roles:", err);
    return defaults;
  }
}

/** Determine the best default redirect for a user based on their roles */
export function getDefaultRedirect(roles: UserRoles): string {
  if (roles.isAdmin) return "/admin/dashboard";
  if (roles.ownedEntities.length > 0) return "/studio/dashboard";
  if (roles.instructorEntities.length > 0) return "/instructor/dashboard";
  return "/no-access";
}
