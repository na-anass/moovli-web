"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CopyIcon, PlusIcon, UsersIcon } from "lucide-react";
import { BaseLayout } from "@/components/layout/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatMoneyWhole } from "@/lib/money";
import {
  adminPlansApi,
  type AdminCapability,
  type AdminPlan,
} from "@/lib/api/adminPlans";
import { PlanEditorSheet } from "./_components/plan-editor-sheet";

/**
 * Plan catalogue for Moovli staff.
 *
 * Plan contents are data (migration 060), so adding a tier — e.g. "Pro" —
 * happens here rather than in a release: duplicate a plan, set its price and
 * capabilities, and point the downgrade ladder at it.
 */
export default function AdminPlansPage() {
  const t = useTranslations("admin.plans");
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [capabilities, setCapabilities] = useState<AdminCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [creating, setCreating] = useState<{ slug: string; name: string; price: number; from: string } | null>(null);
  const [savingNew, setSavingNew] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, capsRes] = await Promise.all([
        adminPlansApi.list(),
        adminPlansApi.capabilities(),
      ]);
      setPlans(plansRes.data);
      setCapabilities(capsRes.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createPlan = async () => {
    if (!creating) return;
    setSavingNew(true);
    setError(null);
    try {
      await adminPlansApi.create({
        slug: creating.slug,
        name: creating.name,
        price_mad: creating.price,
        cloneFromPlanId: creating.from || undefined,
      });
      setCreating(null);
      await fetchAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <BaseLayout
      maxWidth="full"
      title={t("title")}
      subtitle={t("subtitle")}
      action={
        <Button
          size="sm"
          onClick={() => setCreating({ slug: "", name: "", price: 250, from: plans[0]?.id ?? "" })}
        >
          <PlusIcon className="size-4 mr-1.5" />
          {t("newPlan")}
        </Button>
      }
    >
      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <code className="text-xs text-muted-foreground">{plan.slug}</code>
                  {!plan.is_active && <Badge variant="outline">{t("badges.inactive")}</Badge>}
                  {plan.is_default_signup && <Badge>{t("badges.defaultSignup")}</Badge>}
                  {!plan.is_self_serve && (
                    <Badge variant="outline">{t("badges.notSelfServe")}</Badge>
                  )}
                  {!plan.stripe_price_id && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                      {t("badges.noStripePrice")}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatMoneyWhole(plan.price_mad, "MAD")} / {plan.billing_interval} ·{" "}
                  {plan.allowed_channel_types.length} {t("channels")}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UsersIcon className="size-4" />
                  {t("subscribers", { count: plan.subscriber_count })}
                </span>
                <Button size="sm" variant="outline" onClick={() => setEditing(plan)}>
                  {t("edit")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setCreating({ slug: "", name: `${plan.name} Pro`, price: plan.price_mad, from: plan.id })
                  }
                >
                  <CopyIcon className="size-3.5 mr-1.5" />
                  {t("duplicate")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanEditorSheet
        plan={editing}
        plans={plans}
        capabilities={capabilities}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={fetchAll}
      />

      {/* New plan — slug is immutable once created, so it is asked for here only. */}
      <Sheet open={!!creating} onOpenChange={(open) => !open && setCreating(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("newPlan")}</SheetTitle>
          </SheetHeader>
          {creating && (
            <div className="px-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("fields.name")}</span>
                <Input
                  value={creating.name}
                  onChange={(e) => setCreating({ ...creating, name: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("fields.slug")}</span>
                <Input
                  value={creating.slug}
                  placeholder="pro"
                  onChange={(e) => setCreating({ ...creating, slug: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("fields.price")}</span>
                <Input
                  type="number"
                  min={0}
                  value={creating.price}
                  onChange={(e) => setCreating({ ...creating, price: Number(e.target.value) })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("fields.cloneFrom")}</span>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={creating.from}
                  onChange={(e) => setCreating({ ...creating, from: e.target.value })}
                >
                  <option value="">{t("cloneNothing")}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                onClick={createPlan}
                disabled={savingNew || !creating.slug || !creating.name}
                className="w-full"
              >
                {savingNew ? t("saving") : t("create")}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </BaseLayout>
  );
}
