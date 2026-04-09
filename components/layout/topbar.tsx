"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BellIcon,
  ChevronRightIcon,
  UserIcon,
  LogOutIcon,
  GlobeIcon,
} from "lucide-react";
import { ThemeToggle } from "../ui/theme-toggle";

/** Map route segments to readable labels */
const LABELS: Record<string, string> = {
  admin: "Admin",
  studio: "Studio",
  instructor: "Instructor",
  dashboard: "Dashboard",
  users: "Users",
  studios: "Studios",
  bookings: "Bookings",
  analytics: "Analytics",
  schedule: "Schedule",
  pricing: "Pricing",
  instructors: "Instructors",
  insights: "Insights",
  team: "Team",
  settings: "Settings",
  profile: "Profile",
  sessions: "Sessions",
};

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  // Build breadcrumbs from pathname
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] || seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "??";

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
      {/* Left — Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon className="size-3.5 text-muted-foreground" />}
            {crumb.isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <button
                onClick={() => router.push(crumb.href)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </button>
            )}
          </div>
        ))}
      </nav>

      {/* Right — Actions */}
      <div className="flex items-center gap-2">
        {/* Language */}
        <Button variant="ghost" size="icon" className="size-8">
          <GlobeIcon className="size-4 text-muted-foreground" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="size-8 relative">
          <BellIcon className="size-4 text-muted-foreground" />
        </Button>

        {/* Theme */}
        <div className="scale-75">
          <ThemeToggle />
        </div>

        {/* Avatar + Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-border transition-all ml-1">
              <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white font-semibold text-xs">
                {initials}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push("/studio/settings")}
            >
              <UserIcon className="size-4 mr-2" />
              My Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => signOut()}
            >
              <LogOutIcon className="size-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
