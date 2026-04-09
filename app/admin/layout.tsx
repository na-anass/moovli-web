"use client";

import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { TopBar, EditModeProvider } from "@/components/layout/topbar";
import { useAuth } from "@/lib/auth/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboardIcon,
  UsersIcon,
  BuildingIcon,
  BookOpenIcon,
  BarChart3Icon,
  SettingsIcon,
} from "lucide-react";

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboardIcon, href: "/admin/dashboard" },
  { label: "Users", icon: UsersIcon, href: "/admin/users" },
  { label: "Studios", icon: BuildingIcon, href: "/admin/studios" },
  { label: "Bookings", icon: BookOpenIcon, href: "/admin/bookings" },
  { label: "Analytics", icon: BarChart3Icon, href: "/admin/analytics" },
];

const bottomItems: NavItem[] = [
  { label: "Settings", icon: SettingsIcon, href: "/admin/settings" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roles, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!roles?.isAdmin) {
      router.push("/no-access");
    }
  }, [loading, roles, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <EditModeProvider>
    <div className="flex min-h-screen">
      <Sidebar navItems={navItems} bottomItems={bottomItems} title="Admin" subtitle="Moovli" />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
    </EditModeProvider>
  );
}
