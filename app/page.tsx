import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRoles, getDefaultRedirect } from "@/lib/auth/roles";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const roles = await getUserRoles(supabase, user.id);

  // Count how many role types the user has
  const roleCount =
    (roles.isAdmin ? 1 : 0) +
    (roles.ownedEntities.length > 0 ? 1 : 0) +
    (roles.instructorEntities.length > 0 ? 1 : 0);

  // If only one role (or none), redirect directly
  if (roleCount <= 1) {
    redirect(getDefaultRedirect(roles));
  }

  // Multiple roles — show switcher
  redirect("/role-switcher");
}
