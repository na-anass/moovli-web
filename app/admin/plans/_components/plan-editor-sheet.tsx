"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangleIcon, CreditCardIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  adminPlansApi,
  type AdminCapability,
  type AdminPlan,
  type PlanPatch,
} from "@/lib/api/adminPlans";
import type { ChannelType } from "@/lib/api/entityPlans";

/**
 * Plan editor.
 *
 * Every capability renders from the registry, chosen by its `kind` — so a new
 * capability appears here automatically with no change to this file. That is
 * the whole point: launching a tier is data entry.
 */

const CHANNEL_TYPES: ChannelType[] = [
  "marketplace",
  "direct_hosted",
  "direct_link",
  "direct_embed",
];

type Values = Record<string, boolean | number | null>;

export function PlanEditorSheet({
  plan,
  plans,
  capabilities,
  open,
  onOpenChange,
  onSaved,
}: {
  plan: AdminPlan | null;
  plans: AdminPlan[];
  capabilities: AdminCapability[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.plans");
  const [draft, setDraft] = useState<PlanPatch>({});
  const [entitlements, setEntitlements] = useState<Values>({});
  const [channels, setChannels] = useState<ChannelType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNeeded, setSyncNeeded] = useState(false);

  // Reset the form whenever a different plan is opened.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (plan && plan.id !== loadedId) {
    setLoadedId(plan.id);
    setDraft({
      name: plan.name,
      description: plan.description,
      price_mad: plan.price_mad,
      is_active: plan.is_active,
      is_self_serve: plan.is_self_serve,
      is_default_signup: plan.is_default_signup,
      downgrade_plan_id: plan.downgrade_plan_id,
      sort_order: plan.sort_order,
    });
    setEntitlements({ ...(plan.entitlements ?? {}) });
    setChannels([...(plan.allowed_channel_types ?? [])]);
    setSyncNeeded(!plan.stripe_price_id);
    setError(null);
  }

  useEffect(() => {
    if (!open) setLoadedId(null);
  }, [open]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, AdminCapability[]>();
    for (const capability of capabilities) {
      if (capability.kind === "channel") continue; // channels have their own section
      const list = byCategory.get(capability.category) ?? [];
      list.push(capability);
      byCategory.set(capability.category, list);
    }
    return [...byCategory.entries()];
  }, [capabilities]);

  if (!plan) return null;

  const priceChanged = Number(draft.price_mad) !== Number(plan.price_mad);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await adminPlansApi.update(plan.id, {
        ...draft,
        price_mad: Number(draft.price_mad),
        allowed_channel_types: channels,
        entitlements,
      });
      if (res.stripe_sync_required) setSyncNeeded(true);
      onSaved();
      if (!res.stripe_sync_required) onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runStripeSync = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminPlansApi.stripeSync(plan.id, { label: "admin-edit" });
      setSyncNeeded(false);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (channel: ChannelType) =>
    setChannels((current) =>
      current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{plan.name}</SheetTitle>
          <SheetDescription>
            {t("subscriberWarning", { count: plan.subscriber_count })}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-8 space-y-8">
          {/* ── Details ───────────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("sections.details")}</h3>

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">{t("fields.name")}</span>
              <Input
                value={draft.name ?? ""}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">{t("fields.description")}</span>
              <Textarea
                rows={3}
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("fields.price")}</span>
                <Input
                  type="number"
                  min={0}
                  value={draft.price_mad ?? 0}
                  onChange={(e) => setDraft({ ...draft, price_mad: Number(e.target.value) })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">{t("fields.sortOrder")}</span>
                <Input
                  type="number"
                  value={draft.sort_order ?? 0}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                />
              </label>
            </div>

            {(priceChanged || syncNeeded) && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-700 dark:bg-amber-950/40">
                <p className="flex items-start gap-2 text-amber-900 dark:text-amber-100">
                  <AlertTriangleIcon className="size-4 shrink-0" />
                  {t("priceImmutable")}
                </p>
                {syncNeeded && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={runStripeSync} disabled={saving}>
                    <CreditCardIcon className="size-3.5 mr-1.5" />
                    {t("createStripePrice")}
                  </Button>
                )}
              </div>
            )}

            <ToggleRow
              label={t("fields.isActive")}
              hint={t("hints.isActive")}
              checked={!!draft.is_active}
              onChange={(v) => setDraft({ ...draft, is_active: v })}
            />
            <ToggleRow
              label={t("fields.isSelfServe")}
              hint={t("hints.isSelfServe")}
              checked={!!draft.is_self_serve}
              onChange={(v) => setDraft({ ...draft, is_self_serve: v })}
            />
            <ToggleRow
              label={t("fields.isDefaultSignup")}
              hint={t("hints.isDefaultSignup")}
              checked={!!draft.is_default_signup}
              onChange={(v) => setDraft({ ...draft, is_default_signup: v })}
            />

            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">{t("fields.downgradePlan")}</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={draft.downgrade_plan_id ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, downgrade_plan_id: e.target.value || null })
                }
              >
                <option value="">{t("cancelOnLapse")}</option>
                {plans
                  .filter((p) => p.id !== plan.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <span className="text-[11px] text-muted-foreground">{t("hints.downgradePlan")}</span>
            </label>
          </section>

          {/* ── Channels ──────────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("sections.channels")}</h3>
            {CHANNEL_TYPES.map((channel) => {
              const capability = capabilities.find((c) => c.key === `channel.${channel}`);
              return (
                <ToggleRow
                  key={channel}
                  label={capability?.label ?? channel}
                  hint={capability?.description ?? undefined}
                  checked={channels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                />
              );
            })}
          </section>

          {/* ── Capabilities, rendered generically by kind ─────────────── */}
          {grouped.map(([category, items]) => (
            <section key={category} className="space-y-3">
              <h3 className="text-sm font-semibold">{t(`sections.${category}`)}</h3>
              {items.map((capability) => (
                <CapabilityField
                  key={capability.key}
                  capability={capability}
                  value={entitlements[capability.key]}
                  onChange={(value) =>
                    setEntitlements({ ...entitlements, [capability.key]: value })
                  }
                  unlimitedLabel={t("unlimited")}
                />
              ))}
            </section>
          ))}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** One capability: a switch, a capped number, or a percent — chosen by `kind`. */
function CapabilityField({
  capability,
  value,
  onChange,
  unlimitedLabel,
}: {
  capability: AdminCapability;
  value: boolean | number | null | undefined;
  onChange: (value: boolean | number | null) => void;
  unlimitedLabel: string;
}) {
  if (capability.kind === "boolean") {
    return (
      <ToggleRow
        label={capability.label}
        hint={capability.description ?? undefined}
        checked={value === true}
        onChange={onChange}
      />
    );
  }

  if (capability.kind === "limit") {
    const unlimited = value === null || value === undefined;
    return (
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{capability.label}</p>
            {capability.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{capability.description}</p>
            )}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {unlimitedLabel}
            <Switch
              checked={unlimited}
              onCheckedChange={(on) => onChange(on ? null : 10)}
            />
          </label>
        </div>
        {!unlimited && (
          <Input
            type="number"
            min={0}
            value={Number(value ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-8 w-32"
          />
        )}
      </div>
    );
  }

  // percent
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium flex items-center gap-1.5">
          {capability.label}
          {!capability.is_public && <InfoIcon className="size-3 text-muted-foreground" />}
        </p>
        {capability.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{capability.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Input
          type="number"
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 w-20"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}
