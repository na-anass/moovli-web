"use client";

import { Sidebar, type NavItem, type NavItemStatus } from "@/components/layout/sidebar";
import { TopBar, EditModeProvider } from "@/components/layout/topbar";
import { useAuth } from "@/lib/auth/provider";
import { entityPlansApi } from "@/lib/api/entityPlans";
import { studioApi } from "@/lib/api/studio";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3Icon,
  BookOpenIcon,
  CalendarIcon,
  CreditCardIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  UserCircle2Icon,
  Users2Icon,
  UsersIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ChannelKey = "marketplace" | "direct_hosted";

interface ChannelStatuses {
  marketplace: NavItemStatus;
  direct: NavItemStatus;
}

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { roles, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith("/studio/onboarding") ?? false;
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [channelStatuses, setChannelStatuses] = useState<ChannelStatuses>({
    marketplace: "off",
    direct: "off",
  });

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

  // Resolve channel status for sidebar dots/locks.
  useEffect(() => {
    if (!selectedEntityId) return;
    let cancelled = false;
    (async () => {
      try {
        const [subRes, prefRes] = await Promise.all([
          entityPlansApi.getSubscription(selectedEntityId),
          studioApi.getChannelPrefs(selectedEntityId),
        ]);
        if (cancelled) return;
        const allowed = subRes.data.plan?.allowed_channel_types ?? [];
        const allows = (k: ChannelKey) => allowed.includes(k);
        const next: ChannelStatuses = {
          marketplace: !allows("marketplace")
            ? "locked"
            : prefRes.data.marketplace_enabled
              ? "on"
              : "off",
          direct: !allows("direct_hosted")
            ? "locked"
            : prefRes.data.direct_hosted_enabled
              ? "on"
              : "off",
        };
        setChannelStatuses(next);
      } catch (e) {
        // Non-fatal — sidebar simply shows no dots.
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEntityId]);

  const navItems = useMemo((): NavItem[] => {
    const items: NavItem[] = [
      {
        section: "Overview",
        label: "Dashboard",
        icon: LayoutDashboardIcon,
        href: "/studio/dashboard",
      },
      {
        section: "Daily ops",
        label: "Schedule",
        icon: CalendarIcon,
        href: "/studio/schedule",
      },
      { label: "Bookings", icon: BookOpenIcon, href: "/studio/bookings" },
      { label: "Customers", icon: UserCircle2Icon, href: "/studio/customers" },
      {
        section: "Catalog",
        label: "Services",
        icon: PackageIcon,
        href: "/studio/services",
      },
      { label: "Instructors", icon: UsersIcon, href: "/studio/instructors" },
      {
        section: "Channels",
        label: "Marketplace",
        icon: ShoppingBagIcon,
        href: "/studio/channels/marketplace",
        status: channelStatuses.marketplace,
      },
      {
        label: "Direct",
        icon: GlobeIcon,
        href: "/studio/channels/direct",
        status: channelStatuses.direct,
      },
    ];

    if (currentRole === "manager" || currentRole === "owner") {
      items.push({
        section: "Insights",
        label: "Analytics",
        icon: BarChart3Icon,
        href: "/studio/insights",
      });
    }

    if (currentRole === "owner") {
      items.push({
        section: "Team",
        label: "Members",
        icon: Users2Icon,
        href: "/studio/team",
      });
    }

    return items;
  }, [currentRole, channelStatuses]);

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

  // Onboarding wizard renders its own full-page chrome — skip the studio sidebar/topbar.
  if (isOnboarding) {
    return <EditModeProvider>{children}</EditModeProvider>;
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
