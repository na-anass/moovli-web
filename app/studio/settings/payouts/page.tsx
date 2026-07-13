"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { studioApi, type EntityPayoutMethod } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import { AlertCircleIcon, BanknoteIcon, CheckCircleIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function PayoutsSettingsPage() {
  const t = useTranslations("studioSettings.payouts");
  const activeEntity = useActiveEntity();
  const entityId = activeEntity.entityId;
  const role = activeEntity.role;
  const canManage = role === "owner" || role === "manager";

  const [current, setCurrent] = useState<EntityPayoutMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    account_holder: "",
    iban: "",
    bank_name: "",
    swift_bic: "",
  });

  const fetchMethod = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await studioApi.getPayoutMethod(entityId);
      setCurrent(res.data);
      if (res.data) {
        setForm({
          account_holder: res.data.account_holder ?? "",
          iban: res.data.iban ?? "",
          bank_name: res.data.bank_name ?? "",
          swift_bic: res.data.swift_bic ?? "",
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchMethod();
  }, [fetchMethod]);

  const handleSave = async () => {
    if (!entityId) return;
    setSaving(true);
    try {
      const res = await studioApi.updatePayoutMethod(entityId, {
        account_holder: form.account_holder.trim(),
        iban: form.iban.trim() || undefined,
        bank_name: form.bank_name.trim() || undefined,
        swift_bic: form.swift_bic.trim() || undefined,
      });
      setCurrent(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">{t("noStudioAccess")}</div>;
  }

  return (
    <BaseLayout
      maxWidth="md"
      title={t("title")}
      subtitle={t("subtitle")}
    >
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      ) : (
        <>
          {/* Status banner */}
          {current ? (
            current.is_verified ? (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <CheckCircleIcon className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">{t("verifiedTitle")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("verifiedDesc", {
                      account:
                        current.iban?.slice(-4)
                          ? `${current.account_holder} (••• ${current.iban.slice(-4)})`
                          : `${current.account_holder} (${current.bank_name})`,
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <AlertCircleIcon className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">{t("pendingTitle")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t("pendingDesc")}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <AlertCircleIcon className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">{t("noAccountTitle")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("noAccountDesc")}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border p-6 space-y-4">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <BanknoteIcon className="size-4" />
              {t("bankDetails")}
              {current && (
                <Badge variant={current.is_verified ? "default" : "outline"} className="ml-auto">
                  {current.is_verified ? t("verified") : t("pending")}
                </Badge>
              )}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("accountHolder")}
                </label>
                <Input
                  value={form.account_holder}
                  onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                  disabled={!canManage}
                  placeholder={t("accountHolderPlaceholder")}
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">{t("iban")}</label>
                <Input
                  value={form.iban}
                  onChange={(e) =>
                    setForm({ ...form, iban: e.target.value.toUpperCase().replace(/\s/g, "") })
                  }
                  disabled={!canManage}
                  placeholder="MA64 XXXX XXXX XXXX XXXX XXXX XXXX"
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t("ibanHint")}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("bankName")}</label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  disabled={!canManage}
                  placeholder="Attijariwafa Bank"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("swiftBic")} <span className="text-[10px]">{t("optional")}</span>
                </label>
                <Input
                  value={form.swift_bic}
                  onChange={(e) =>
                    setForm({ ...form, swift_bic: e.target.value.toUpperCase() })
                  }
                  disabled={!canManage}
                  placeholder="BCMAMAMC"
                  className="mt-1 font-mono text-sm"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground border-t pt-3">
              {t("resetNotice")}
            </p>

            {canManage && (
              <div className="flex items-center justify-end gap-3 pt-1">
                {saved && (
                  <span className="inline-flex items-center text-xs text-emerald-600">
                    <CheckCircleIcon className="size-3 mr-1" /> {t("saved")}
                  </span>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving || !form.account_holder.trim()}
                >
                  {saving ? t("saving") : current ? t("update") : t("saveBankDetails")}
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{t("whenPayoutsTitle")}</p>
            {t("whenPayoutsDesc")}
          </div>
        </>
      )}
    </BaseLayout>
  );
}
