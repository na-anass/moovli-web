"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon, LogOutIcon, MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "../ui/theme-toggle";
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
  title: string;
  subtitle?: string;
  className?: string;
}

export function Sidebar({ navItems, title, subtitle, className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "??";

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed z-[999] right-2 bottom-2 size-14 bg-foreground rounded-full"
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
                className="fixed right-0 top-0 h-full w-full bg-background shadow-xl z-[101] md:hidden"
              >
                <div className="flex h-full flex-col">
                  <div className="flex h-16 items-center gap-2.5 px-4 border-b border-border">
                    <Image src="/img/moovli-icon.png" alt="Moovli" width={28} height={28} className="rounded-md" />
                    <span className="text-sm font-semibold">{title}</span>
                    {subtitle && (
                      <span className="ml-1 text-xs text-muted-foreground truncate">
                        {subtitle}
                      </span>
                    )}
                  </div>
                  <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link href={item.href} key={item.label}>
                          <Button
                            variant={isActive(item.href) ? "secondary" : "ghost"}
                            className="w-full justify-start mb-1 rounded-lg px-3"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <Icon className="h-5 w-5 mr-3" />
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs">
                                {item.badge}
                              </span>
                            )}
                          </Button>
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="px-4 mb-4">
                    <ThemeToggle />
                  </div>
                  <div className="border-t p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white font-semibold text-sm">
                        {initials}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate">
                          {user?.email}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={signOut}>
                        <LogOutIcon className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Desktop sidebar */}
        <div
          className={cn(
            "hidden md:block sticky top-0 h-screen border-r border-border bg-background transition-all duration-300",
            isCollapsed ? "w-16" : "w-64",
            className
          )}
        >
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-border relative">
              {!isCollapsed ? (
                <div className="flex items-center gap-2.5">
                  <Image src="/img/moovli-icon.png" alt="Moovli" width={32} height={32} className="rounded-lg shrink-0" />
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
                <Image src="/img/moovli-icon.png" alt="Moovli" width={28} height={28} className="rounded-lg mx-auto" />
              )}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 rounded-full border border-border bg-background shadow-sm",
                  isCollapsed
                    ? "absolute -right-3"
                    : "absolute top-5 -right-3"
                )}
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                <ChevronLeftIcon
                  className={cn(
                    "h-3 w-3 transition-transform",
                    isCollapsed && "rotate-180"
                  )}
                />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                const button = (
                  <Link href={item.href} key={item.label}>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start mb-1 rounded-lg",
                        isCollapsed ? "px-0 justify-center" : "px-3",
                        active && "dark:bg-card"
                      )}
                    >
                      <Icon
                        className={cn("h-5 w-5", !isCollapsed && "mr-3")}
                      />
                      {!isCollapsed && <span>{item.label}</span>}
                      {!isCollapsed && item.badge && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs">
                          {item.badge}
                        </span>
                      )}
                    </Button>
                  </Link>
                );

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.label}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return button;
              })}
            </nav>

            {/* Footer */}
            <div className="px-4 mb-4">
              <ThemeToggle />
            </div>
            <div className="border-t p-4">
              {!isCollapsed ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-3 cursor-pointer hover:bg-secondary p-2 rounded-lg">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white font-semibold text-sm shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={signOut}
                    >
                      <LogOutIcon className="size-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white font-semibold text-sm mx-auto cursor-pointer">
                      {initials}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-sm">{user?.email}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>
    </>
  );
}
