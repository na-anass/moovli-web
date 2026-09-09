"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    // Recovery links land on /set-password (same screen invited owners use); it
    // reads the session tokens from the URL hash.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/set-password`,
    });
    // Always show the same confirmation (don't reveal whether the email exists).
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-xl bg-primary-50 p-2">
            <Image src="/img/moovli-icon.png" alt="Moovli" width={48} height={48} />
          </div>
        </div>

        {sent ? (
          <div className="space-y-3 text-center">
            <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("sent")}</p>
            <a href="/login" className="inline-block text-sm font-medium text-primary hover:underline">
              {t("backToLogin")}
            </a>
          </div>
        ) : (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t("emailLabel")}</label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
                {loading ? t("submitting") : t("submit")}
              </Button>
              <a
                href="/login"
                className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("backToLogin")}
              </a>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
