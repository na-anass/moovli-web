"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/provider";
import { setLocale } from "@/lib/i18n/set-locale";
import { apiClient } from "@/lib/api/client";
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
  CheckIcon,
  ChevronRightIcon,
  UserIcon,
  LogOutIcon,
  GlobeIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import { ThemeToggle } from "../ui/theme-toggle";

// ============================================================================
// EDIT MODE CONTEXT — lets any page push save/discard to the top bar
// ============================================================================

interface EditModeState {
  editing: boolean;
  saving: boolean;
  title?: string;
  onSave: () => void;
  onCancel: () => void;
}

interface EditModeContextValue {
  editMode: EditModeState | null;
  setEditMode: (state: EditModeState | null) => void;
}

const EditModeContext = createContext<EditModeContextValue>({
  editMode: null,
  setEditMode: () => {},
});

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState<EditModeState | null>(null);
  return (
    <EditModeContext.Provider value={{ editMode, setEditMode }}>
      {children}
    </EditModeContext.Provider>
  );
}

export const useEditMode = () => useContext(EditModeContext);

// ============================================================================
// TOP BAR
// ============================================================================

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { user, signOut } = useAuth();
  const { editMode } = useEditMode();

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: t.has(`crumbs.${seg}`) ? t(`crumbs.${seg}`) : seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  const switchLocale = async (next: "en" | "fr") => {
    if (next === locale) return;
    await setLocale(next);
    // Best-effort cross-device persistence; the cookie already drives the UI.
    apiClient("/api/users/me", {
      method: "PUT",
      body: JSON.stringify({ preferred_language: next }),
    }).catch(() => {});
    router.refresh();
  };

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "??";

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
      {/* Left side */}
      {editMode?.editing ? (
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium">
            {editMode.title || t("editing")}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {t("unsavedChanges")}
          </span>
        </div>
      ) : (
        <nav className="flex items-center gap-1 text-sm">
          {crumbs.map((crumb, i) => (
            <div key={crumb.href} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              )}
              {crumb.isLast ? (
                <span className="font-medium text-foreground">
                  {crumb.label}
                </span>
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
      )}

      {/* Right side */}
      {editMode?.editing ? (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={editMode.onCancel}
            disabled={editMode.saving}
          >
            <XIcon className="size-4 mr-1.5" />
            {tc("discard")}
          </Button>
          <Button
            size="sm"
            onClick={editMode.onSave}
            disabled={editMode.saving}
          >
            <SaveIcon className="size-4 mr-1.5" />
            {editMode.saving ? tc("saving") : tc("save")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-muted-foreground"
                aria-label={t("language")}
              >
                <GlobeIcon className="size-4" />
                <span className="text-xs font-medium">{locale.toUpperCase()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem className="cursor-pointer" onClick={() => switchLocale("en")}>
                English
                {locale === "en" && <CheckIcon className="size-4 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => switchLocale("fr")}>
                Français
                {locale === "fr" && <CheckIcon className="size-4 ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="size-8 relative" aria-label={t("notifications")}>
            <BellIcon className="size-4 text-muted-foreground" />
          </Button>
          <div className="scale-75">
            <ThemeToggle />
          </div>
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
                onClick={() => {
                  const portal = pathname.split("/")[1] || "studio";
                  router.push(`/${portal}/account`);
                }}
              >
                <UserIcon className="size-4 mr-2" />
                {t("myAccount")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => signOut()}
              >
                <LogOutIcon className="size-4 mr-2" />
                {t("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
}
