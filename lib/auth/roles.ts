import type { SupabaseClient } from "@supabase/supabase-js";

export interface EntityMembership {
  entityId: string;
  entityName: string;
  role: "owner" | "manager" | "staff";
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

export async function getUserRoles(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRoles> {
  const [userResult, entityOwnersResult, instructorResult] = await Promise.all([
    supabase.from("users").select("is_admin").eq("id", userId).single(),
    supabase
      .from("entity_owners")
      .select("entity_id, role, entities(name)")
      .eq("user_id", userId),
    supabase
      .from("service_providers")
      .select("id, primary_entity_id, entities(name)")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  const isAdmin = (userResult.data as any)?.is_admin ?? false;

  const ownedEntities: EntityMembership[] = (
    (entityOwnersResult.data as any[]) || []
  ).map((row) => ({
    entityId: row.entity_id,
    entityName: row.entities?.name || "Unknown",
    role: row.role,
  }));

  const instructorEntities: InstructorMembership[] = (
    (instructorResult.data as any[]) || []
  )
    .filter((row) => row.primary_entity_id)
    .map((row) => ({
      providerId: row.id,
      entityId: row.primary_entity_id,
      entityName: row.entities?.name || "Unknown",
    }));

  return { isAdmin, ownedEntities, instructorEntities };
}

/** Determine the best default redirect for a user based on their roles */
export function getDefaultRedirect(roles: UserRoles): string {
  if (roles.isAdmin) return "/admin/dashboard";
  if (roles.ownedEntities.length > 0) return "/studio/dashboard";
  if (roles.instructorEntities.length > 0) return "/instructor/dashboard";
  return "/no-access";
}
