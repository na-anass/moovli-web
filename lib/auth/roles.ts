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

    // Single consolidated call — isAdmin is resolved server-side from req.user,
    // so there's no extra (deliberately-failing) admin probe.
    const me = await fetch(`${apiUrl}/api/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .catch(() => ({ data: {} }));

    const data = me.data || {};
    const isAdmin = !!data.isAdmin;

    const ownedEntities: EntityMembership[] = ((data.ownedEntities as any[]) || []).map(
      (row: any) => ({
        entityId: row.entityId || row.entity_id,
        entityName: row.entity?.name || "Studio",
        role: row.role,
        onboardedAt: row.entity?.onboarded_at ?? null,
        currencyCode: row.entity?.currency_code ?? "MAD",
      })
    );

    const instructorEntities: InstructorMembership[] = ((data.instructorEntities as any[]) || []).map(
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
  if (roles.ownedEntities.length > 0) {
    // Brand-new studios (never finished the wizard) go straight to onboarding —
    // skipping a flash of the dashboard before the client-side gate bounces them.
    if (roles.ownedEntities[0].onboardedAt === null) return "/studio/onboarding";
    return "/studio/dashboard";
  }
  if (roles.instructorEntities.length > 0) return "/instructor/dashboard";
  return "/no-access";
}
