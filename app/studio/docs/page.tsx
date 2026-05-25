"use client";

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
    title: "Getting started",
    description: "Quick-start guide for new studios — onboard, set up services, take your first booking.",
    href: "/studio/onboarding",
    icon: PlayCircleIcon,
    accent: "primary" as const,
    badge: null,
  },
  {
    title: "Services & pricing",
    description: "How to structure services, set default capacity and price, and use categories.",
    href: "/studio/services",
    icon: PackageIcon,
    accent: "violet" as const,
    badge: null,
  },
  {
    title: "Scheduling sessions",
    description: "Drag-to-create on the calendar, recurring sessions, per-channel allocation.",
    href: "/studio/schedule",
    icon: CalendarIcon,
    accent: "emerald" as const,
    badge: null,
  },
  {
    title: "Channels — Direct booking",
    description: "Your public booking page: branding, link sharing, on/off control.",
    href: "/studio/channels/direct",
    icon: GlobeIcon,
    accent: "emerald" as const,
    badge: null,
  },
  {
    title: "Channels — Marketplace",
    description: "Get discovered in the Moovli mobile app. Pricing breakdown + dynamic markup.",
    href: "/studio/channels/marketplace",
    icon: ShoppingBagIcon,
    accent: "violet" as const,
    badge: null,
  },
  {
    title: "Customers & CRM",
    description: "How acquisition source is attributed, customer lifetime value, marketing consent.",
    href: "/studio/customers",
    icon: UsersIcon,
    accent: "amber" as const,
    badge: null,
  },
  {
    title: "Billing & subscription",
    description: "Plan switches, trial, payment method, invoices, cancellation.",
    href: "/studio/billing",
    icon: CreditCardIcon,
    accent: "rose" as const,
    badge: null,
  },
  {
    title: "Payouts",
    description: "Bank details for receiving marketplace payouts. Verification flow.",
    href: "/studio/settings/payouts",
    icon: CoinsIcon,
    accent: "amber" as const,
    badge: null,
  },
];

export default function StudioDocsPage() {
  return (
    <BaseLayout
      maxWidth="lg"
      icon={BookOpenIcon}
      title="Help center"
      subtitle="Guides, FAQs, and quick links to the most-asked questions. More long-form docs landing soon."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOPICS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${ACCENT_CLASS[t.accent]}`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                      {t.title}
                    </h3>
                    {t.badge && (
                      <Badge variant="outline" className="text-[10px]">
                        {t.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {t.description}
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
          <h3 className="font-semibold">Still stuck?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Our team is here to help. Reach out and we&apos;ll get back to you within a business day.
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
