"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeftRightIcon,
  ChevronLeftIcon,
  LockIcon,
  MenuIcon,
  XIcon,
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

export type NavItemStatus = "on" | "off" | "locked";

export interface NavItem {
  label: string;
  /** Optional — children are shown as nested links when sidebar is expanded. */
  icon?: React.ElementType;
  href: string;
  badge?: number;
  /** Section heading displayed above this item (rendered once per unique value). */
  section?: string;
  /** Nested children — only rendered when the sidebar is expanded. */
  children?: NavItem[];
  /** Adds a small status indicator after the label (dot for on/off, lock for locked). */
  status?: NavItemStatus;
}

interface SidebarProps {
  navItems: NavItem[];
  /** Bottom nav items like Settings — shown above the footer */
  bottomItems?: NavItem[];
  title: string;
  subtitle?: string;
  className?: string;
}

const STATUS_STYLES: Record<NavItemStatus, { dot: string; tooltipKey: string }> = {
  on: { dot: "bg-emerald-500", tooltipKey: "statusActive" },
  off: { dot: "bg-muted-foreground/40", tooltipKey: "statusOff" },
  locked: { dot: "", tooltipKey: "statusLocked" },
};

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
  const t = useTranslations("nav");
  const { roles } = useAuth();
  const router = useRouter();

  const roleCount =
    (roles?.isAdmin ? 1 : 0) +
    ((roles?.ownedEntities?.length ?? 0) > 0 ? 1 : 0) +
    ((roles?.instructorEntities?.length ?? 0) > 0 ? 1 : 0);

  // Exact match OR descendant — but never let a parent steal the highlight from a child.
  const isActive = (item: NavItem): boolean => {
    if (pathname === item.href) return true;
    if (!pathname.startsWith(item.href.endsWith("/") ? item.href : `${item.href}/`)) {
      return false;
    }
    // If any sibling/child has a more specific match, defer.
    const childMatch = item.children?.some((c) => pathname.startsWith(c.href));
    return !childMatch;
  };

  // A parent is "open" (expanded child list visible) whenever any child is active OR
  // the parent itself is the current route. Otherwise children are still rendered (we don't
  // collapse), but the parent stays muted.
  const renderStatus = (status?: NavItemStatus) => {
    if (!status) return null;
    if (status === "locked") {
      return <LockIcon className="size-3 text-muted-foreground/70 ml-auto" />;
    }
    return (
      <span
        className={cn("ml-auto size-1.5 rounded-full", STATUS_STYLES[status].dot)}
        aria-label={t(STATUS_STYLES[status].tooltipKey)}
      />
    );
  };

  const renderLeaf = (
    item: NavItem,
    {
      collapsed,
      depth = 0,
      onClose,
    }: { collapsed: boolean; depth?: number; onClose?: () => void },
  ) => {
    const Icon = item.icon;
    const active = isActive(item);
    const isChild = depth > 0;

    const button = (
      <Link href={item.href} key={item.label} aria-current={active ? "page" : undefined}>
        <Button
          variant="ghost"
          className={cn(
            "relative w-full justify-start mb-0.5 rounded-lg",
            collapsed ? "px-0 justify-center h-9" : isChild ? "h-8 px-3 pl-10" : "h-9 px-3",
            active
              ? isChild
                ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-medium"
                : "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary"
              : isChild
                ? "text-muted-foreground/80 hover:text-foreground"
                : "text-muted-foreground hover:text-foreground",
          )}
          onClick={onClose}
        >
          {Icon && (
            <Icon
              className={cn(
                isChild ? "h-3.5 w-3.5" : "h-4 w-4",
                !collapsed && (isChild ? "mr-2.5" : "mr-3"),
                active && "text-primary",
              )}
            />
          )}
          {!collapsed && <span className={cn("text-sm", isChild && "text-[13px]")}>{item.label}</span>}
          {!collapsed && item.badge ? (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs">
              {item.badge}
            </span>
          ) : (
            !collapsed && renderStatus(item.status)
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

  /** Renders a flat list with section headings inserted on section boundaries. */
  const renderList = (items: NavItem[], collapsed: boolean, onClose?: () => void) => {
    const nodes: React.ReactNode[] = [];
    let prevSection: string | undefined;
    items.forEach((item, index) => {
      if (!collapsed && item.section && item.section !== prevSection) {
        nodes.push(
          <div
            key={`section-${item.section}-${index}`}
            className={cn(
              "px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60",
              index === 0 ? "pt-1 pb-1.5" : "pt-4 pb-1.5",
            )}
          >
            {item.section}
          </div>,
        );
      }
      if (collapsed && item.section && item.section !== prevSection && index > 0) {
        nodes.push(<div key={`divider-${index}`} className="my-2 h-px bg-border/60" />);
      }
      prevSection = item.section ?? prevSection;

      nodes.push(renderLeaf(item, { collapsed, onClose }));

      // Render nested children only when expanded — they're noise in collapsed mode.
      if (!collapsed && item.children && item.children.length > 0) {
        item.children.forEach((child) => {
          nodes.push(renderLeaf(child, { collapsed: false, depth: 1, onClose }));
        });
      }
    });
    return nodes;
  };

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed z-[999] right-3 bottom-3 size-12 bg-foreground rounded-full"
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
                className="fixed right-0 top-0 h-full w-72 bg-background z-[101] md:hidden"
              >
                <div className="flex h-full flex-col">
                  <div className="flex h-14 items-center gap-2.5 px-4 border-b border-border">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary-50 p-1 shrink-0">
                      <Image src="/img/moovli-icon.png" alt="Moovli" width={24} height={24} />
                    </div>
                    <span className="text-sm font-semibold">{title}</span>
                    {subtitle && (
                      <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
                    )}
                  </div>
                  <nav className="flex-1 p-2 overflow-y-auto">
                    {renderList(navItems, false, () => setIsMobileMenuOpen(false))}
                    {bottomItems.length > 0 && (
                      <>
                        <Separator className="my-2" />
                        {renderList(bottomItems, false, () => setIsMobileMenuOpen(false))}
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
                        {t("switchRole")}
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
            "hidden md:flex flex-col sticky top-0 h-screen border-r border-border bg-background transition-all duration-300 z-40",
            isCollapsed ? "w-16" : "w-56",
            className,
          )}
        >
          {/* Header */}
          <div className="flex h-14 items-center justify-between px-3 border-b border-border relative shrink-0">
            {!isCollapsed ? (
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary-50 p-1 shrink-0">
                  <Image src="/img/moovli-icon.png" alt="Moovli" width={24} height={24} />
                </div>
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
              <div className="mx-auto flex size-8 items-center justify-center rounded-lg bg-primary-50 p-1">
                <Image src="/img/moovli-icon.png" alt="Moovli" width={24} height={24} />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 rounded-full border border-border bg-background absolute -right-3 z-40",
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
            {renderList(navItems, isCollapsed)}
          </nav>

          {/* Bottom section — Settings, Profile, Switch Role */}
          <div className="p-2 border-t border-border shrink-0">
            {renderList(bottomItems, isCollapsed)}
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
                    <TooltipContent side="right">{t("switchRole")}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-3 mb-1 rounded-lg text-sm"
                    onClick={() => router.push("/role-switcher")}
                  >
                    <ArrowLeftRightIcon className="h-4 w-4 mr-3" />
                    {t("switchRole")}
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
