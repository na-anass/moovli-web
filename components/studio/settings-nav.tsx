"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  label: string;
  href: string;
  icon: LucideIcon;
}

const ITEMS: SettingsNavItem[] = [
  { label: "General", href: "/studio/settings/general", icon: BuildingIcon },
  { label: "Branding", href: "/studio/settings/branding", icon: ImageIcon },
  { label: "Hours", href: "/studio/settings/hours", icon: ClockIcon },
  { label: "Policies", href: "/studio/settings/policies", icon: ShieldIcon },
  { label: "Payouts", href: "/studio/settings/payouts", icon: BanknoteIcon },
];

export function SettingsNav() {
  const pathname = usePathname();

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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
