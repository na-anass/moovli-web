"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

export default function SetPasswordPage() {
  const t = useTranslations("auth.setPassword");
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Invite / recovery links (GoTrue /verify) redirect here with the session in
  // the URL hash (#access_token=…&refresh_token=…). Pick those up and establish
  // the session, then confirm it. No session → the link expired or was reused.
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
          const p = new URLSearchParams(window.location.hash.slice(1));
          const access_token = p.get("access_token");
          const refresh_token = p.get("refresh_token");
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
            // clear the tokens from the address bar
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
        }
      } catch {
        /* fall through to the getUser check */
      }
      const { data } = await supabase.auth.getUser();
      setHasSession(!!data.user);
      setChecking(false);
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message || t("genericError"));
      setSaving(false);
      return;
    }
    // New owners land on onboarding; the studio layout routes anyone already
    // onboarded onward.
    router.push("/studio/onboarding");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-xl bg-primary-50 p-2">
            <Image src="/img/moovli-icon.png" alt="Moovli" width={48} height={48} />
          </div>
        </div>

        {checking ? (
          <div className="h-40 rounded-xl border border-border bg-card animate-pulse" />
        ) : !hasSession ? (
          <div className="space-y-3 text-center">
            <h1 className="text-2xl font-bold text-foreground">{t("noSession")}</h1>
            <p className="text-sm text-muted-foreground">{t("noSessionHint")}</p>
            <a
              href="/forgot-password"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              /forgot-password
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
                <label className="text-sm font-medium text-foreground">{t("newPassword")}</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t("confirm")}</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={saving}>
                {saving ? t("submitting") : t("submit")}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
