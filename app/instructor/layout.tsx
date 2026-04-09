"use client";

import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { useAuth } from "@/lib/auth/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboardIcon,
  CalendarIcon,
  UserIcon,
} from "lucide-react";

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboardIcon, href: "/instructor/dashboard" },
  { label: "Schedule", icon: CalendarIcon, href: "/instructor/schedule" },
  { label: "Profile", icon: UserIcon, href: "/instructor/profile" },
];

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roles, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!roles?.isAdmin && (roles?.instructorEntities ?? []).length === 0) {
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
      <Sidebar navItems={navItems} title="Instructor" />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
