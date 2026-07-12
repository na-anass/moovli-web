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

  let roles;
  try {
    roles = await getUserRoles(session.access_token);
  } catch {
    // /api/me couldn't be reached (fresh-login token/cookie lag or API hiccup).
    // Bounce back to login to retry rather than mislabeling the user as having
    // no roles and stranding them on /no-access.
    redirect("/login");
  }

  const roleCount =
    (roles.isAdmin ? 1 : 0) +
    (roles.ownedEntities.length > 0 ? 1 : 0) +
    (roles.instructorEntities.length > 0 ? 1 : 0);

  if (roleCount <= 1) {
    redirect(getDefaultRedirect(roles));
  }

  redirect("/role-switcher");
}
