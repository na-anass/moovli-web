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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirect("/login");
  }

  const roles = await getUserRoles(session.access_token);

  const roleCount =
    (roles.isAdmin ? 1 : 0) +
    (roles.ownedEntities.length > 0 ? 1 : 0) +
    (roles.instructorEntities.length > 0 ? 1 : 0);

  if (roleCount <= 1) {
    redirect(getDefaultRedirect(roles));
  }

  redirect("/role-switcher");
}
