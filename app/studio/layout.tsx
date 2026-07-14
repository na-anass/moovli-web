"use client";

import { Sidebar, type NavItem, type NavItemStatus } from "@/components/layout/sidebar";
import { TopBar, EditModeProvider } from "@/components/layout/topbar";
import { FullPageLoader } from "@/components/layout/full-page-loader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/provider";
import { ActiveEntityProvider, useActiveEntity } from "@/lib/studio/active-entity";
import { entityPlansApi } from "@/lib/api/entityPlans";
import { studioApi } from "@/lib/api/studio";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  BarChart3Icon,
  BookOpenIcon,
  CalendarIcon,
  CreditCardIcon,
  EyeIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  UserCircle2Icon,
  Users2Icon,
  UsersIcon,
  XIcon,
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
  const { roles, loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith("/studio/onboarding") ?? false;

  const entities = useMemo(() => roles?.ownedEntities ?? [], [roles]);

  // Single source of truth for "should this user be sent elsewhere?". Computed
  // before render so we can hold the loader and never paint a protected page.
  // The onboarding gate lives HERE (not in the dashboard page) so a brand-new
  // studio never sees the dashboard flash before the wizard. null = stay.
  const redirectTarget = useMemo<string | null>(() => {
    if (loading) return null;
    // Not signed in (e.g. just signed out) → login, NOT /no-access.
    if (!user) return "/login";
    if (!roles?.isAdmin && entities.length === 0) return "/no-access";
    if (
      !isOnboarding &&
      !roles?.isAdmin &&
      entities.length > 0 &&
      entities[0].onboardedAt === null
    ) {
      return "/studio/onboarding";
    }
    return null;
  }, [loading, user, roles, entities, isOnboarding]);

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  // Hold the loader while auth resolves OR a guard redirect is in flight, so a
  // protected studio page (or the dashboard pre-onboarding) never paints.
  if (loading || redirectTarget) {
    return <FullPageLoader />;
  }

  // Onboarding wizard renders its own full-page chrome — skip the studio sidebar/topbar.
  if (isOnboarding) {
    return <EditModeProvider>{children}</EditModeProvider>;
  }

  return (
    <EditModeProvider>
      <Suspense fallback={<FullPageLoader />}>
        <ActiveEntityProvider>
          <StudioChrome>{children}</StudioChrome>
        </ActiveEntityProvider>
      </Suspense>
    </EditModeProvider>
  );
}

/** Studio sidebar/topbar chrome — reads the active studio (selection or admin impersonation). */
function StudioChrome({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("studioMain");
  const {
    entityId,
    entityName,
    role,
    entities,
    isImpersonating,
    setSelectedEntityId,
    exitImpersonation,
  } = useActiveEntity();

  const [channelStatuses, setChannelStatuses] = useState<ChannelStatuses>({
    marketplace: "off",
    direct: "off",
  });

  // Resolve channel status for sidebar dots/locks against the active studio.
  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    (async () => {
      try {
        const [subRes, prefRes] = await Promise.all([
          entityPlansApi.getSubscription(entityId),
          studioApi.getChannelPrefs(entityId),
        ]);
        if (cancelled) return;
        const allowed = subRes.data.plan?.allowed_channel_types ?? [];
        const allows = (k: ChannelKey) => allowed.includes(k);
        setChannelStatuses({
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
        });
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  const navItems = useMemo((): NavItem[] => {
    const items: NavItem[] = [
      { section: t("sidebar.sectionOverview"), label: t("sidebar.dashboard"), icon: LayoutDashboardIcon, href: "/studio/dashboard" },
      { section: t("sidebar.sectionDailyOps"), label: t("sidebar.schedule"), icon: CalendarIcon, href: "/studio/schedule" },
      { label: t("sidebar.bookings"), icon: BookOpenIcon, href: "/studio/bookings" },
      { label: t("sidebar.customers"), icon: UserCircle2Icon, href: "/studio/customers" },
      { section: t("sidebar.sectionCatalog"), label: t("sidebar.services"), icon: PackageIcon, href: "/studio/services" },
      { label: t("sidebar.instructors"), icon: UsersIcon, href: "/studio/instructors" },
      {
        section: t("sidebar.sectionChannels"),
        label: t("sidebar.marketplace"),
        icon: ShoppingBagIcon,
        href: "/studio/channels/marketplace",
        status: channelStatuses.marketplace,
      },
      { label: t("sidebar.direct"), icon: GlobeIcon, href: "/studio/channels/direct", status: channelStatuses.direct },
    ];

    if (role === "manager" || role === "owner") {
      items.push({ section: t("sidebar.sectionInsights"), label: t("sidebar.analytics"), icon: BarChart3Icon, href: "/studio/insights" });
    }
    if (role === "owner") {
      items.push({ section: t("sidebar.sectionTeam"), label: t("sidebar.members"), icon: Users2Icon, href: "/studio/team" });
    }
    return items;
  }, [role, channelStatuses, t]);

  const bottomItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];
    if (role === "owner" || role === "manager") {
      items.push({ label: t("sidebar.billing"), icon: CreditCardIcon, href: "/studio/billing" });
    }
    items.push({ label: t("sidebar.docs"), icon: LifeBuoyIcon, href: "/studio/docs" });
    items.push({ label: t("sidebar.settings"), icon: SettingsIcon, href: "/studio/settings" });
    return items;
  }, [role, t]);

  return (
    <div className="flex min-h-screen">
      <Sidebar navItems={navItems} bottomItems={bottomItems} title={t("sidebar.title")} subtitle={entityName ?? undefined} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        {/* Admin impersonation banner */}
        {isImpersonating && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-6 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="flex items-center gap-2 text-xs font-medium">
              <EyeIcon className="size-3.5" />
              {t("impersonation.banner", { studio: entityName ?? t("impersonation.thisStudio") })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                exitImpersonation();
                router.push("/admin/studios");
              }}
            >
              <XIcon className="size-3.5 mr-1" /> {t("impersonation.exit")}
            </Button>
          </div>
        )}

        {/* Multi-studio switcher (real owners only) */}
        {entities.length > 1 && (
          <div className="border-b border-border px-6 py-2 shrink-0">
            <Select value={entityId ?? ""} onValueChange={setSelectedEntityId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder={t("switcher.selectEntity")} />
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
  );
}
