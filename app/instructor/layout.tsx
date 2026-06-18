"use client";

import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { TopBar, EditModeProvider } from "@/components/layout/topbar";
import { FullPageLoader } from "@/components/layout/full-page-loader";
import { useAuth } from "@/lib/auth/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboardIcon,
  CalendarIcon,
  UserIcon,
  SettingsIcon,
} from "lucide-react";

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboardIcon, href: "/instructor/dashboard" },
  { label: "Schedule", icon: CalendarIcon, href: "/instructor/schedule" },
];

const bottomItems: NavItem[] = [
  { label: "Profile", icon: UserIcon, href: "/instructor/profile" },
  { label: "Settings", icon: SettingsIcon, href: "/instructor/settings" },
];

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roles, loading } = useAuth();
  const router = useRouter();

  const redirectTarget =
    !loading && !roles?.isAdmin && (roles?.instructorEntities ?? []).length === 0
      ? "/no-access"
      : null;

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  // Hold the loader until authorization resolves / any redirect completes.
  if (loading || redirectTarget) {
    return <FullPageLoader />;
  }

  return (
    <EditModeProvider>
    <div className="flex min-h-screen">
      <Sidebar navItems={navItems} bottomItems={bottomItems} title="Instructor" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
    </EditModeProvider>
  );
}
