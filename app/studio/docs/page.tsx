"use client";

import { useTranslations } from "next-intl";
import { BaseLayout } from "@/components/layout/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarIcon,
  CoinsIcon,
  CreditCardIcon,
  GlobeIcon,
  LifeBuoyIcon,
  MailIcon,
  PackageIcon,
  PlayCircleIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

// ============================================================================
// Topic cards — each links to an in-app destination (or external doc later).
// ============================================================================

const TOPICS = [
  {
    key: "gettingStarted",
    href: "/studio/onboarding",
    icon: PlayCircleIcon,
    accent: "primary" as const,
    badge: null,
  },
  {
    key: "servicesPricing",
    href: "/studio/services",
    icon: PackageIcon,
    accent: "violet" as const,
    badge: null,
  },
  {
    key: "scheduling",
    href: "/studio/schedule",
    icon: CalendarIcon,
    accent: "emerald" as const,
    badge: null,
  },
  {
    key: "channelsDirect",
    href: "/studio/channels/direct",
    icon: GlobeIcon,
    accent: "emerald" as const,
    badge: null,
  },
  {
    key: "channelsMarketplace",
    href: "/studio/channels/marketplace",
    icon: ShoppingBagIcon,
    accent: "violet" as const,
    badge: null,
  },
  {
    key: "customersCrm",
    href: "/studio/customers",
    icon: UsersIcon,
    accent: "amber" as const,
    badge: null,
  },
  {
    key: "billing",
    href: "/studio/billing",
    icon: CreditCardIcon,
    accent: "rose" as const,
    badge: null,
  },
  {
    key: "payouts",
    href: "/studio/settings/payouts",
    icon: CoinsIcon,
    accent: "amber" as const,
    badge: null,
  },
];

export default function StudioDocsPage() {
  const t = useTranslations("studioMain");
  return (
    <BaseLayout
      maxWidth="lg"
      icon={BookOpenIcon}
      title={t("docs.title")}
      subtitle={t("docs.subtitle")}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          return (
            <Link
              key={topic.href}
              href={topic.href}
              className="group rounded-xl border bg-card p-5 hover:border-primary/40 transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${ACCENT_CLASS[topic.accent]}`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                      {t(`docs.topics.${topic.key}.title`)}
                    </h3>
                    {topic.badge && (
                      <Badge variant="outline" className="text-[10px]">
                        {topic.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {t(`docs.topics.${topic.key}.description`)}
                  </p>
                </div>
                <ArrowRightIcon className="size-3.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Need help? contact card */}
      <div className="rounded-xl border border-dashed bg-card p-6 flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LifeBuoyIcon className="size-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{t("docs.stillStuck")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("docs.stillStuckDesc")}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:support@moovli.app">
                <MailIcon className="size-3.5 mr-1.5" />
                support@moovli.app
              </a>
            </Button>
          </div>
        </div>
      </div>
    </BaseLayout>
  );
}

// ============================================================================
// Accent palette — matches BaseLayout's iconAccent options
// ============================================================================

const ACCENT_CLASS: Record<
  "primary" | "violet" | "emerald" | "amber" | "rose" | "slate",
  string
> = {
  primary: "bg-primary/10 text-primary",
  violet: "bg-violet-100 text-violet-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
};
