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
import { useAuth } from "@/lib/auth/provider";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LockIcon,
  PaletteIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const DEFAULT_COLOR = "#f26c2c";

const PRESETS = [
  { label: "Moovli orange", value: "#f26c2c" },
  { label: "Magenta", value: "#d946ef" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Slate", value: "#64748b" },
];

const PUBLIC_BOOKING_BASE =
  process.env.NEXT_PUBLIC_BOOKING_BASE_URL || "https://booking.moovli.app";
const IS_SUBDOMAIN_BASE = /\/\/booking\./.test(PUBLIC_BOOKING_BASE);

const directHostedUrl = (slug: string): string =>
  IS_SUBDOMAIN_BASE
    ? `${PUBLIC_BOOKING_BASE}/${slug}`
    : `${PUBLIC_BOOKING_BASE}/booking/${slug}`;

export default function StudioChannelDirectPage() {
  const { roles } = useAuth();
  const currency = roles?.ownedEntities?.[0]?.currencyCode ?? "MAD";
  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const role = roles?.ownedEntities?.[0]?.role;
  const canManage = role === "owner" || role === "manager" || roles?.isAdmin;

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
    return <div className="p-8 text-muted-foreground">No studio access found.</div>;
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  const isDirty = color !== originalColor;
  const directOn = !!prefs?.direct_hosted_enabled;
  const isLive = planAllowsDirect && directOn && !!channel;

  return (
    <BaseLayout
      icon={GlobeIcon}
      iconAccent="emerald"
      title="Direct booking page"
      subtitle="Customize your studio's public hosted page."
      action={
        planAllowsDirect && canManage ? (
          <>
            <span className="text-xs text-muted-foreground">
              {isLive ? "Active" : "Off"}
            </span>
            <Switch
              checked={directOn}
              disabled={togglingPref}
              onCheckedChange={toggleDirect}
              aria-label="Toggle direct booking page"
            />
          </>
        ) : !planAllowsDirect ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            <LockIcon className="size-2.5 mr-1" /> Plan required
          </Badge>
        ) : null
      }
    >
      {/* Page URL section */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Your page</h2>
          {isLive ? (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 mr-1" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Off
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
                  Preview
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isLive
                ? "Your page is visible to anyone with this link. Bookings show up in your Bookings inbox as pending — confirm to lock in the seat."
                : directOn
                  ? "Your page is configured but the channel is currently off."
                  : "Preview your page, then publish to make it live."}
            </p>
            {/* Explicit publish CTA — clearer than the header switch when the
                page is configured but not yet live. */}
            {planAllowsDirect && canManage && !isLive && (
              <Button size="sm" onClick={() => toggleDirect(true)} disabled={togglingPref}>
                <CheckIcon className="size-3.5 mr-1.5" />
                {togglingPref ? "Publishing…" : "Publish page — go live"}
              </Button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Default page hasn&apos;t been provisioned yet. Contact support.
          </p>
        )}
      </section>

      {/* Branding section */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <PaletteIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Branding</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Your brand color is used for the Book button, session highlights, and key accents on
          your public page.
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
            placeholder="#f26c2c"
            className="w-32 h-12 font-mono text-sm"
          />
          <span className="text-xs text-muted-foreground">
            Click the swatch to pick, or type a hex code.
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
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
              {p.label}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="border-t pt-4 mt-1">
          <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Preview
          </h3>
          <div
            className="rounded-lg border p-4 space-y-3"
            style={{ borderLeftColor: color, borderLeftWidth: 3 }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="font-semibold">18:00 · Yoga Flow</div>
                <div className="text-xs text-muted-foreground">60 min · with Sara</div>
              </div>
              <div className="text-right">
                <div className="font-semibold" style={{ color }}>
                  {formatMoneyWhole(100, currency)}
                </div>
                <div className="text-[10px] text-muted-foreground">at studio</div>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              Book
            </button>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center justify-between pt-3 border-t">
            <Button variant="ghost" size="sm" onClick={handleResetBrand} disabled={savingBrand}>
              Reset to default
            </Button>
            <div className="flex items-center gap-3">
              {brandSaved && (
                <span className="inline-flex items-center text-xs text-emerald-600">
                  <CheckIcon className="size-3 mr-1" /> Saved
                </span>
              )}
              <Button onClick={handleSaveBrand} disabled={!isDirty || savingBrand}>
                {savingBrand ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Coming soon */}
      <section className="rounded-xl border border-dashed p-5 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">Coming soon</p>
        <p>• Logo upload + cover image dedicated to the booking page</p>
        <p>• Welcome message + cancellation policy text</p>
        <p>• Custom domain (e.g. book.yourstudio.com)</p>
        <p>• Embeddable widget code (drop your calendar into any site)</p>
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
