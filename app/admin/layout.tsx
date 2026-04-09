"use client";

import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { useAuth } from "@/lib/auth/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboardIcon,
  UsersIcon,
  BuildingIcon,
  BookOpenIcon,
  BarChart3Icon,
} from "lucide-react";

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboardIcon, href: "/admin/dashboard" },
  { label: "Users", icon: UsersIcon, href: "/admin/users" },
  { label: "Studios", icon: BuildingIcon, href: "/admin/studios" },
  { label: "Bookings", icon: BookOpenIcon, href: "/admin/bookings" },
  { label: "Analytics", icon: BarChart3Icon, href: "/admin/analytics" },
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
    <div className="flex min-h-screen">
      <Sidebar navItems={navItems} title="Admin" subtitle="Moovli" />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
