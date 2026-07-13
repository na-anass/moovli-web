"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BanknoteIcon,
  BuildingIcon,
  ClockIcon,
  ImageIcon,
  ShieldIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsNavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

const ITEMS: SettingsNavItem[] = [
  { labelKey: "general", href: "/studio/settings/general", icon: BuildingIcon },
  { labelKey: "branding", href: "/studio/settings/branding", icon: ImageIcon },
  { labelKey: "hours", href: "/studio/settings/hours", icon: ClockIcon },
  { labelKey: "policies", href: "/studio/settings/policies", icon: ShieldIcon },
  { labelKey: "payouts", href: "/studio/settings/payouts", icon: BanknoteIcon },
];

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("studioSettings.nav");

  return (
    <nav className="space-y-0.5">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 h-9 text-sm transition-colors",
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <Icon className={cn("size-4", active && "text-primary")} />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
