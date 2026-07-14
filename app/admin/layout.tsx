"use client";

import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { TopBar, EditModeProvider } from "@/components/layout/topbar";
import { FullPageLoader } from "@/components/layout/full-page-loader";
import { useAuth } from "@/lib/auth/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboardIcon,
  UsersIcon,
  BuildingIcon,
  BookOpenIcon,
  BarChart3Icon,
  SettingsIcon,
  SlidersHorizontalIcon,
  GraduationCapIcon,
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roles, loading, user } = useAuth();
  const router = useRouter();
  const t = useTranslations("admin");

  const navItems: NavItem[] = [
    { label: t("sidebar.dashboard"), icon: LayoutDashboardIcon, href: "/admin/dashboard" },
    { label: t("sidebar.users"), icon: UsersIcon, href: "/admin/users" },
    { label: t("sidebar.studios"), icon: BuildingIcon, href: "/admin/studios" },
    { label: t("sidebar.instructors"), icon: GraduationCapIcon, href: "/admin/instructors" },
    { label: t("sidebar.bookings"), icon: BookOpenIcon, href: "/admin/bookings" },
    { label: t("sidebar.analytics"), icon: BarChart3Icon, href: "/admin/analytics" },
    { label: t("sidebar.policies"), icon: SlidersHorizontalIcon, href: "/admin/policies" },
  ];

  const bottomItems: NavItem[] = [
    { label: t("sidebar.settings"), icon: SettingsIcon, href: "/admin/settings" },
  ];

  const redirectTarget = loading
    ? null
    : !user
      ? "/login"
      : !roles?.isAdmin
        ? "/no-access"
        : null;

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  // Hold the loader until authorization resolves / any redirect completes — never
  // paint the admin chrome for a non-admin.
  if (loading || redirectTarget) {
    return <FullPageLoader />;
  }

  return (
    <EditModeProvider>
    <div className="flex min-h-screen">
      <Sidebar navItems={navItems} bottomItems={bottomItems} title={t("sidebar.title")} subtitle="Moovli" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
    </EditModeProvider>
  );
}
