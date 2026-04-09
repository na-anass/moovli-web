"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeftIcon,
  MenuIcon,
  XIcon,
  ArrowLeftRightIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/provider";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
}

interface SidebarProps {
  navItems: NavItem[];
  /** Bottom nav items like Settings — shown above the footer */
  bottomItems?: NavItem[];
  title: string;
  subtitle?: string;
  className?: string;
}

export function Sidebar({
  navItems,
  bottomItems = [],
  title,
  subtitle,
  className,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { roles } = useAuth();
  const router = useRouter();

  const roleCount =
    (roles?.isAdmin ? 1 : 0) +
    ((roles?.ownedEntities?.length ?? 0) > 0 ? 1 : 0) +
    ((roles?.instructorEntities?.length ?? 0) > 0 ? 1 : 0);

  const isActive = (href: string) => pathname.startsWith(href);

  const renderNavItem = (item: NavItem, collapsed: boolean, onClose?: () => void) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    const button = (
      <Link href={item.href} key={item.label}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start mb-1 rounded-lg",
            collapsed ? "px-0 justify-center" : "px-3",
            active
              ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={onClose}
        >
          <Icon className={cn("h-4 w-4", !collapsed && "mr-3", active && "text-primary")} />
          {!collapsed && <span className="text-sm">{item.label}</span>}
          {!collapsed && item.badge && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs">
              {item.badge}
            </span>
          )}
        </Button>
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return button;
  };

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed z-[999] right-3 bottom-3 size-12 bg-foreground rounded-full shadow-lg"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <XIcon className="size-5 text-background" />
        ) : (
          <MenuIcon className="size-5 text-background" />
        )}
      </Button>

      <TooltipProvider delayDuration={0}>
        {/* Mobile sidebar */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-[100] md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-72 bg-background shadow-xl z-[101] md:hidden"
              >
                <div className="flex h-full flex-col">
                  <div className="flex h-14 items-center gap-2.5 px-4 border-b border-border">
                    <Image src="/img/moovli-icon.png" alt="Moovli" width={28} height={28} className="rounded-md" />
                    <span className="text-sm font-semibold">{title}</span>
                    {subtitle && (
                      <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
                    )}
                  </div>
                  <nav className="flex-1 p-2 overflow-y-auto">
                    {navItems.map((item) => renderNavItem(item, false, () => setIsMobileMenuOpen(false)))}
                    {bottomItems.length > 0 && (
                      <>
                        <Separator className="my-2" />
                        {bottomItems.map((item) => renderNavItem(item, false, () => setIsMobileMenuOpen(false)))}
                      </>
                    )}
                  </nav>
                  {roleCount > 1 && (
                    <div className="px-3 pb-3">
                      <Button
                        variant="outline"
                        className="w-full justify-start text-sm"
                        onClick={() => {
                          router.push("/role-switcher");
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <ArrowLeftRightIcon className="size-4 mr-2" />
                        Switch Role
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Desktop sidebar */}
        <div
          className={cn(
            "hidden md:flex flex-col sticky top-0 h-screen border-r border-border bg-background transition-all duration-300",
            isCollapsed ? "w-16" : "w-56",
            className
          )}
        >
          {/* Header */}
          <div className="flex h-14 items-center justify-between px-3 border-b border-border relative shrink-0">
            {!isCollapsed ? (
              <div className="flex items-center gap-2.5">
                <Image src="/img/moovli-icon.png" alt="Moovli" width={28} height={28} className="rounded-lg shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold leading-tight">{title}</span>
                  {subtitle && (
                    <span className="text-[11px] text-muted-foreground truncate leading-tight">
                      {subtitle}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <Image src="/img/moovli-icon.png" alt="Moovli" width={24} height={24} className="rounded-lg mx-auto" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 rounded-full border border-border bg-background shadow-sm absolute -right-3",
              )}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <ChevronLeftIcon
                className={cn("h-3 w-3 transition-transform", isCollapsed && "rotate-180")}
              />
            </Button>
          </div>

          {/* Main navigation */}
          <nav className="flex-1 p-2 overflow-y-auto">
            {navItems.map((item) => renderNavItem(item, isCollapsed))}
          </nav>

          {/* Bottom section — Settings, Profile, Switch Role */}
          <div className="p-2 border-t border-border shrink-0">
            {bottomItems.map((item) => renderNavItem(item, isCollapsed))}
            {roleCount > 1 && (
              <>
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-center px-0 mb-1 rounded-lg"
                        onClick={() => router.push("/role-switcher")}
                      >
                        <ArrowLeftRightIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Switch Role</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-3 mb-1 rounded-lg text-sm"
                    onClick={() => router.push("/role-switcher")}
                  >
                    <ArrowLeftRightIcon className="h-4 w-4 mr-3" />
                    Switch Role
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </TooltipProvider>
    </>
  );
}
