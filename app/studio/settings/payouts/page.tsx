"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { studioApi, type EntityPayoutMethod } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { AlertCircleIcon, BanknoteIcon, CheckCircleIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function PayoutsSettingsPage() {
  const { roles } = useAuth();
  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const role = roles?.ownedEntities?.[0]?.role;
  const canManage = role === "owner" || role === "manager" || roles?.isAdmin;

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
    return <div className="p-8 text-muted-foreground">No studio access found.</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          The bank account Moovli sends your marketplace earnings to.
          Direct booking payments are collected at your studio — they don't go through Moovli.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* Status banner */}
          {current ? (
            current.is_verified ? (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <CheckCircleIcon className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Verified payout account</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Marketplace earnings will be sent to {current.account_holder} (
                    {current.iban?.slice(-4) ? `••• ${current.iban.slice(-4)}` : current.bank_name})
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <AlertCircleIcon className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Pending verification</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Moovli will verify this account before your first payout. You can still
                    accept marketplace bookings; earnings accrue until verification completes.
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <AlertCircleIcon className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">No payout account on file</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Add your bank account below so we can send you your marketplace earnings.
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border p-6 space-y-4">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <BanknoteIcon className="size-4" />
              Bank account details
              {current && (
                <Badge variant={current.is_verified ? "default" : "outline"} className="ml-auto">
                  {current.is_verified ? "Verified" : "Pending"}
                </Badge>
              )}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Account holder name *
                </label>
                <Input
                  value={form.account_holder}
                  onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                  disabled={!canManage}
                  placeholder="Full legal name or business name"
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">IBAN</label>
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
                  Moroccan IBAN: 28 characters starting with MA64.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Bank name</label>
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
                  SWIFT / BIC <span className="text-[10px]">(optional)</span>
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
              Updating these details resets verification. We'll re-verify before the next payout.
            </p>

            {canManage && (
              <div className="flex items-center justify-end gap-3 pt-1">
                {saved && (
                  <span className="inline-flex items-center text-xs text-emerald-600">
                    <CheckCircleIcon className="size-3 mr-1" /> Saved
                  </span>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving || !form.account_holder.trim()}
                >
                  {saving ? "Saving…" : current ? "Update" : "Save bank details"}
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">When do payouts happen?</p>
            Payout schedule, frequency, and minimum thresholds will be configured by Moovli once
            Spec D (wallet + payout engine) ships. In the meantime, your earnings accrue and
            we'll send them manually based on the bank details above.
          </div>
        </>
      )}
    </div>
  );
}
