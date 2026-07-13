"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { ChannelDeactivateSheet } from "@/components/studio/channel-deactivate-sheet";
import { formatMoneyWhole } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { channelsApi, type Channel } from "@/lib/api/channels";
import { entityPlansApi } from "@/lib/api/entityPlans";
import { studioApi, type ChannelPrefs } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LockIcon,
  PaletteIcon,
} from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

const DEFAULT_COLOR = "#7c3aed";

const PRESET_COLORS: { labelKey: string; value: string }[] = [
  { labelKey: "moovliViolet", value: "#7c3aed" },
  { labelKey: "magenta", value: "#d946ef" },
  { labelKey: "teal", value: "#14b8a6" },
  { labelKey: "indigo", value: "#6366f1" },
  { labelKey: "rose", value: "#f43f5e" },
  { labelKey: "emerald", value: "#10b981" },
  { labelKey: "amber", value: "#f59e0b" },
  { labelKey: "slate", value: "#64748b" },
];

const PUBLIC_BOOKING_BASE =
  process.env.NEXT_PUBLIC_BOOKING_BASE_URL || "https://booking.moovli.app";
const IS_SUBDOMAIN_BASE = /\/\/booking\./.test(PUBLIC_BOOKING_BASE);

const directHostedUrl = (slug: string): string =>
  IS_SUBDOMAIN_BASE
    ? `${PUBLIC_BOOKING_BASE}/${slug}`
    : `${PUBLIC_BOOKING_BASE}/booking/${slug}`;

export default function StudioChannelDirectPage() {
  const t = useTranslations("studioChannels.direct");
  const tc = useTranslations("common");
  const activeEntity = useActiveEntity();
  const currency = activeEntity.currencyCode;
  const entityId = activeEntity.entityId;
  const role = activeEntity.role;
  const canManage = role === "owner" || role === "manager";

  const [channel, setChannel] = useState<Channel | null>(null);
  const [prefs, setPrefs] = useState<ChannelPrefs | null>(null);
  const [planAllowsDirect, setPlanAllowsDirect] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  // Branding state
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [originalColor, setOriginalColor] = useState<string>(DEFAULT_COLOR);
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [togglingPref, setTogglingPref] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const [chRes, brandRes, prefRes, subRes] = await Promise.all([
        channelsApi.listForEntity(entityId),
        studioApi.getBranding(entityId),
        studioApi.getChannelPrefs(entityId),
        entityPlansApi.getSubscription(entityId),
      ]);
      setChannel(chRes.data.find((c) => c.type === "direct_hosted") ?? null);
      const c = brandRes.data.primary_color ?? DEFAULT_COLOR;
      setColor(c);
      setOriginalColor(c);
      setPrefs(prefRes.data);
      setPlanAllowsDirect(
        !!subRes.data.plan?.allowed_channel_types.includes("direct_hosted"),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaveBrand = async () => {
    if (!entityId) return;
    setSavingBrand(true);
    try {
      await studioApi.updateBranding(entityId, color);
      setOriginalColor(color);
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2000);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingBrand(false);
    }
  };

  const handleResetBrand = async () => {
    if (!entityId) return;
    setSavingBrand(true);
    try {
      await studioApi.updateBranding(entityId, null);
      setColor(DEFAULT_COLOR);
      setOriginalColor(DEFAULT_COLOR);
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2000);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingBrand(false);
    }
  };

  // Track whether the deactivation confirmation sheet is open. Turning the
  // channel OFF goes through the sheet (impact + policy); turning it back ON
  // is non-destructive so it stays a direct API call.
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const toggleDirect = async (next: boolean) => {
    if (!entityId || !prefs) return;
    if (!next) {
      // OFF → open the confirmation sheet. Actual API call fires from the
      // sheet's policy submission via onDeactivated below.
      setDeactivateOpen(true);
      return;
    }
    // ON → straightforward re-enable, no sheet.
    setTogglingPref(true);
    const previous = prefs;
    setPrefs({ ...prefs, direct_hosted_enabled: true });
    try {
      const res = await studioApi.updateChannelPrefs(entityId, {
        direct_hosted_enabled: true,
      });
      setPrefs(res.data);
    } catch (e) {
      console.error(e);
      setPrefs(previous);
    } finally {
      setTogglingPref(false);
    }
  };

  // Called by ChannelDeactivateSheet after a successful POST .../deactivate.
  // The endpoint already flipped the pref + applied the chosen policy, so
  // just update local state to reflect that.
  const handleDeactivated = () => {
    if (prefs) setPrefs({ ...prefs, direct_hosted_enabled: false });
  };

  const copyUrl = () => {
    if (!channel) return;
    navigator.clipboard.writeText(directHostedUrl(channel.slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">{t("noAccess")}</div>;
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">{tc("loading")}</div>;
  }

  const isDirty = color !== originalColor;
  const directOn = !!prefs?.direct_hosted_enabled;
  const isLive = planAllowsDirect && directOn && !!channel;

  return (
    <BaseLayout
      icon={GlobeIcon}
      iconAccent="emerald"
      title={t("title")}
      subtitle={t("subtitle")}
      maxWidth="xl"
      action={
        planAllowsDirect && canManage ? (
          <>
            <span className="text-xs text-muted-foreground">
              {isLive ? t("active") : t("off")}
            </span>
            <Switch
              checked={directOn}
              disabled={togglingPref}
              onCheckedChange={toggleDirect}
              aria-label={t("toggleAria")}
            />
          </>
        ) : !planAllowsDirect ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            <LockIcon className="size-2.5 mr-1" /> {t("planRequired")}
          </Badge>
        ) : null
      }
    >
      {/* Page URL section */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold inline-flex items-center gap-1.5">
            {t("yourPage")}
            <InfoTip term="direct" />
          </h2>
          {isLive ? (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 mr-1" />
              {t("live")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              {t("off")}
            </Badge>
          )}
        </div>

        {channel ? (
          <>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={directHostedUrl(channel.slug)}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={copyUrl}>
                {copied ? (
                  <CheckIcon className="size-3.5 text-emerald-600" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={directHostedUrl(channel.slug)} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon className="size-3.5 mr-1.5" />
                  {t("preview")}
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isLive
                ? t("pageHelpLive")
                : directOn
                  ? t("pageHelpConfiguredOff")
                  : t("pageHelpPreview")}
            </p>
            {/* Explicit publish CTA — clearer than the header switch when the
                page is configured but not yet live. */}
            {planAllowsDirect && canManage && !isLive && (
              <Button size="sm" onClick={() => toggleDirect(true)} disabled={togglingPref}>
                <CheckIcon className="size-3.5 mr-1.5" />
                {togglingPref ? t("publishing") : t("publishGoLive")}
              </Button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("notProvisioned")}
          </p>
        )}
      </section>

      {/* Branding section */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <PaletteIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t("branding")}</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          {t("brandingHelp")}
        </p>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={!canManage}
            className="size-12 rounded border cursor-pointer disabled:cursor-not-allowed"
          />
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value.toLowerCase())}
            disabled={!canManage}
            placeholder="#7c3aed"
            className="w-32 h-12 font-mono text-sm"
          />
          <span className="text-xs text-muted-foreground">
            {t("colorHelp")}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((p) => (
            <button
              key={p.value}
              onClick={() => canManage && setColor(p.value)}
              disabled={!canManage}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs hover:bg-accent disabled:opacity-50"
            >
              <span
                className="size-3 rounded-full ring-1 ring-border"
                style={{ backgroundColor: p.value }}
              />
              {t(`presets.${p.labelKey}`)}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="border-t pt-4 mt-1">
          <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {t("previewLabel")}
          </h3>
          <div
            className="rounded-lg border p-4 space-y-3"
            style={{ borderLeftColor: color, borderLeftWidth: 3 }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="font-semibold">{t("previewSessionTitle")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("previewSessionMeta")}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold" style={{ color }}>
                  {formatMoneyWhole(100, currency)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t("previewAtStudio")}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {t("book")}
            </button>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center justify-between pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={handleResetBrand} disabled={savingBrand}>
              {t("resetToDefault")}
            </Button>
            <div className="flex items-center gap-3">
              {brandSaved && (
                <span className="inline-flex items-center text-xs text-emerald-600">
                  <CheckIcon className="size-3 mr-1" /> {t("saved")}
                </span>
              )}
              <Button onClick={handleSaveBrand} disabled={!isDirty || savingBrand}>
                {savingBrand ? tc("saving") : t("saveChanges")}
              </Button>
            </div>
          </div>
        )}
      </section>

      <ChannelDeactivateSheet
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        entityId={entityId}
        channelType="direct_hosted"
        onDeactivated={handleDeactivated}
      />
    </BaseLayout>
  );
}
