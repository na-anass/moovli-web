"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Reusable message + confirmation dialogs (web)
// ----------------------------------------------------------------------------
// Replaces native window.alert / window.confirm with the app's Dialog UI.
// Wrap a subtree in <DialogsProvider> and call useDialogs():
//   const { notify, confirm } = useDialogs();
//   notify("Couldn't save.", { variant: "error" });
//   if (await confirm({ message: "Remove this class?", destructive: true })) { … }
// ============================================================================

export type NotifyVariant = "info" | "error" | "success";

interface NotifyOptions {
  title?: string;
  variant?: NotifyVariant;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface DialogsApi {
  /** Show an OK-only message dialog. */
  notify: (message: string, opts?: NotifyOptions) => void;
  /** Show a confirm/cancel dialog. Resolves true on confirm, false otherwise. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

type ModalState =
  | { kind: "notify"; title: string; message: string; variant: NotifyVariant }
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      destructive: boolean;
      resolve: (value: boolean) => void;
    }
  | null;

const DialogsContext = createContext<DialogsApi | null>(null);

const VARIANT_ICON = {
  info: InfoIcon,
  error: AlertTriangleIcon,
  success: CheckCircle2Icon,
} as const;

const VARIANT_ICON_CLASS: Record<NotifyVariant, string> = {
  info: "text-primary",
  error: "text-destructive",
  success: "text-emerald-600",
};

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shared");
  const tc = useTranslations("common");
  const [state, setState] = useState<ModalState>(null);

  const defaultTitle: Record<NotifyVariant, string> = {
    info: t("dialogs.defaultTitle.info"),
    error: t("dialogs.defaultTitle.error"),
    success: t("dialogs.defaultTitle.success"),
  };

  const notify = useCallback(
    (message: string, opts?: NotifyOptions) => {
      const variant = opts?.variant ?? "info";
      setState({
        kind: "notify",
        title: opts?.title ?? defaultTitle[variant],
        message,
        variant,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({
          kind: "confirm",
          title: opts.title ?? t("dialogs.confirmTitle"),
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? tc("confirm"),
          cancelLabel: opts.cancelLabel ?? tc("cancel"),
          destructive: !!opts.destructive,
          resolve,
        });
      }),
    [t, tc],
  );

  const api = useMemo<DialogsApi>(() => ({ notify, confirm }), [notify, confirm]);

  // Closing without an explicit choice counts as "cancel" for confirm dialogs.
  const handleOpenChange = (open: boolean) => {
    if (open) return;
    setState((prev) => {
      if (prev?.kind === "confirm") prev.resolve(false);
      return null;
    });
  };

  const resolveConfirm = (value: boolean) => {
    setState((prev) => {
      if (prev?.kind === "confirm") prev.resolve(value);
      return null;
    });
  };

  const Icon = state && state.kind === "notify" ? VARIANT_ICON[state.variant] : null;

  return (
    <DialogsContext.Provider value={api}>
      {children}

      <Dialog open={!!state} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          {state?.kind === "notify" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {Icon && (
                    <Icon className={cn("size-5", VARIANT_ICON_CLASS[state.variant])} />
                  )}
                  {state.title}
                </DialogTitle>
                <DialogDescription className="pt-1 text-foreground/80">
                  {state.message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setState(null)}>{t("dialogs.ok")}</Button>
              </DialogFooter>
            </>
          )}

          {state?.kind === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle>{state.title}</DialogTitle>
                <DialogDescription className="pt-1 text-foreground/80">
                  {state.message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => resolveConfirm(false)}>
                  {state.cancelLabel}
                </Button>
                <Button
                  variant={state.destructive ? "destructive" : "default"}
                  onClick={() => resolveConfirm(true)}
                >
                  {state.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs must be used within <DialogsProvider>");
  return ctx;
}
