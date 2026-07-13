"use client";

import { useAuth } from "@/lib/auth/provider";
import { Button } from "@/components/ui/button";
import { ShieldOffIcon, LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export default function NoAccessPage() {
  const { user, signOut } = useAuth();
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md px-4">
        <div className="flex justify-center">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <ShieldOffIcon className="size-8 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{t("noAccess.title")}</h1>
          <p className="text-muted-foreground">
            {t.rich("noAccess.description", {
              email: user?.email ?? "",
              strong: (chunks) => (
                <span className="font-medium text-foreground">{chunks}</span>
              ),
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("noAccess.contact")}
          </p>
        </div>
        <Button onClick={() => signOut()} variant="outline">
          <LogOutIcon className="size-4 mr-2" />
          {t("signOut")}
        </Button>
      </div>
    </div>
  );
}
