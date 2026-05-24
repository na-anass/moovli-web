"use client";

import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { TopBar, EditModeProvider } from "@/components/layout/topbar";
import { useAuth } from "@/lib/auth/provider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboardIcon,
  CalendarIcon,
  BookOpenIcon,
  CoinsIcon,
  UsersIcon,
  UserCircle2Icon,
  PackageIcon,
  BarChart3Icon,
  SettingsIcon,
  Users2Icon,
  UserIcon,
  Share2Icon,
  CreditCardIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roles, loading } = useAuth();
  const router = useRouter();
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const entities = roles?.ownedEntities ?? [];

  useEffect(() => {
    if (loading) return;
    if (!roles?.isAdmin && entities.length === 0) {
      router.push("/no-access");
      return;
    }
    if (entities.length > 0 && !selectedEntityId) {
      setSelectedEntityId(entities[0].entityId);
    }
  }, [loading, roles, entities, selectedEntityId, router]);

  const currentRole = useMemo(() => {
    if (roles?.isAdmin) return "owner" as const;
    const membership = entities.find((e) => e.entityId === selectedEntityId);
    return membership?.role ?? ("staff" as const);
  }, [roles, entities, selectedEntityId]);

  const navItems = useMemo((): NavItem[] => {
    // Daily operations — what studios touch every day
    const items: NavItem[] = [
      { label: "Dashboard", icon: LayoutDashboardIcon, href: "/studio/dashboard" },
      { label: "Schedule", icon: CalendarIcon, href: "/studio/schedule" },
      { label: "Bookings", icon: BookOpenIcon, href: "/studio/bookings" },
      { label: "Channels", icon: Share2Icon, href: "/studio/channels" },
      { label: "Customers", icon: UserCircle2Icon, href: "/studio/customers" },
    ];

    // Catalog — set up once, edited occasionally
    items.push(
      { label: "Services", icon: PackageIcon, href: "/studio/services" },
      { label: "Instructors", icon: UsersIcon, href: "/studio/instructors" },
    );

    // Manager+ analytics
    if (currentRole === "manager" || currentRole === "owner") {
      items.push({ label: "Insights", icon: BarChart3Icon, href: "/studio/insights" });
    }

    // Owner-only
    if (currentRole === "owner") {
      items.push({ label: "Team", icon: Users2Icon, href: "/studio/team" });
    }

    return items;
  }, [currentRole]);

  const bottomItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];
    if (currentRole === "owner" || currentRole === "manager") {
      items.push({ label: "Billing", icon: CreditCardIcon, href: "/studio/billing" });
    }
    items.push({ label: "Settings", icon: SettingsIcon, href: "/studio/settings" });
    return items;
  }, [currentRole]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const currentEntity = entities.find((e) => e.entityId === selectedEntityId);

  return (
    <EditModeProvider>
    <div className="flex min-h-screen">
      <Sidebar
        navItems={navItems}
        bottomItems={bottomItems}
        title="Studio"
        subtitle={currentEntity?.entityName}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        {entities.length > 1 && (
          <div className="border-b border-border px-6 py-2 shrink-0">
            <Select
              value={selectedEntityId ?? ""}
              onValueChange={setSelectedEntityId}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.entityId} value={e.entityId}>
                    {e.entityName} ({e.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
    </EditModeProvider>
  );
}
