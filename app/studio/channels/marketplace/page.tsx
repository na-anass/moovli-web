"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { ChannelDeactivateSheet } from "@/components/studio/channel-deactivate-sheet";
import { formatMoneyWhole } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { entityPlansApi, type EntityPlan } from "@/lib/api/entityPlans";
import { studioApi, type ChannelPrefs } from "@/lib/api/studio";
import { useActiveEntity } from "@/lib/studio/active-entity";
import {
  ArrowRightIcon,
  CoinsIcon,
  LockIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function StudioChannelMarketplacePage() {
  const activeEntity = useActiveEntity();
  const currency = activeEntity.currencyCode;
  const entityId = activeEntity.entityId;
  const role = activeEntity.role;
  const canManage = role === "owner" || role === "manager";

  const [plan, setPlan] = useState<EntityPlan | null>(null);
  const [prefs, setPrefs] = useState<ChannelPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Studio-set markup slider state.
  const MARKUP_FLOOR = 20;
  const MARKUP_CEILING = 50;
  const [markup, setMarkup] = useState<number>(MARKUP_FLOOR);
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [markupSaved, setMarkupSaved] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const [subRes, prefRes] = await Promise.all([
        entityPlansApi.getSubscription(entityId),
        studioApi.getChannelPrefs(entityId),
      ]);
      setPlan(subRes.data.plan);
      setPrefs(prefRes.data);
      // Initialize the slider from the studio's saved markup, falling back to
      // the plan's baseline (clamped to the allowed range).
      const saved = prefRes.data.marketplace_markup_pct;
      const baseline = Math.round(Number(subRes.data.plan?.base_markup_pct ?? MARKUP_FLOOR));
      setMarkup(Math.max(MARKUP_FLOOR, Math.min(MARKUP_CEILING, saved ?? baseline)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  const saveMarkup = async () => {
    if (!entityId) return;
    setSavingMarkup(true);
    setMarkupSaved(false);
    try {
      const res = await studioApi.updateChannelPrefs(entityId, { marketplace_markup_pct: markup });
      setPrefs(res.data);
      setMarkupSaved(true);
      setTimeout(() => setMarkupSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingMarkup(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // OFF → confirmation sheet (impact + policy); ON → direct API call.
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const toggleMarketplace = async (next: boolean) => {
    if (!entityId || !prefs) return;
    if (!next) {
      setDeactivateOpen(true);
      return;
    }
    setToggling(true);
    const previous = prefs;
    setPrefs({ ...prefs, marketplace_enabled: true });
    try {
      const res = await studioApi.updateChannelPrefs(entityId, {
        marketplace_enabled: true,
      });
      setPrefs(res.data);
    } catch (e) {
      console.error(e);
      setPrefs(previous);
    } finally {
      setToggling(false);
    }
  };

  const handleDeactivated = () => {
    if (prefs) setPrefs({ ...prefs, marketplace_enabled: false });
  };

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">No studio access found.</div>;
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  const planAllows = !!plan?.allowed_channel_types.includes("marketplace");
  const marketplaceOn = !!prefs?.marketplace_enabled;
  const isLive = planAllows && marketplaceOn;
  const baseMarkup = Math.round(Number(plan?.base_markup_pct ?? 0));

  return (
    <BaseLayout
      icon={ShoppingBagIcon}
      iconAccent="violet"
      title="Marketplace"
      subtitle="Your sessions discoverable in the Moovli mobile app."
      action={
        planAllows && canManage ? (
          <>
            <span className="text-xs text-muted-foreground">
              {isLive ? "Active" : "Off"}
            </span>
            <Switch
              checked={marketplaceOn}
              disabled={toggling}
              onCheckedChange={toggleMarketplace}
              aria-label="Toggle marketplace listing"
            />
          </>
        ) : !planAllows ? (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-700"
          >
            <LockIcon className="size-2.5 mr-1" /> Plan upgrade required
          </Badge>
        ) : null
      }
    >

      {/* Plan gate */}
      {!planAllows && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <TrendingUpIcon className="size-4" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Unlock marketplace bookings</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Your current plan ({plan?.name ?? "Standard"}) doesn&apos;t include marketplace
                distribution. Upgrade to Marketplace to start receiving bookings from Moovli
                app users — you keep 100% of your session price and Moovli adds a small
                platform margin on top.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link href="/studio/billing">
                  Upgrade plan
                  <ArrowRightIcon className="size-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Status panel — only when plan allows */}
      {planAllows && (
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Listing status</h2>
            {isLive ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 mr-1" />
                Live in app
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Paused
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isLive
              ? "Your published sessions appear in the Moovli app discovery feed and studio listings. Bookings are paid via Moovli and you receive payouts on the standard schedule."
              : "Your sessions are not visible in the Moovli app. Existing marketplace bookings remain valid and will be honored — only future discoverability is paused."}
          </p>
        </section>
      )}

      {/* Pricing & markup explainer */}
      {planAllows && (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CoinsIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Pricing on the marketplace</h2>
          </div>

          <div className="rounded-lg bg-muted/40 p-4">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Your session price
                </div>
                <div className="text-xl font-semibold mt-0.5">{formatMoneyWhole(100, currency)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  You always receive this amount
                </div>
              </div>
              <div className="text-muted-foreground">+</div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Marketplace markup
                </div>
                <div className="text-xl font-semibold mt-0.5">{markup}%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  You set this
                </div>
              </div>
              <div className="text-muted-foreground">=</div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Booker pays
                </div>
                <div className="text-xl font-semibold mt-0.5 text-primary">
                  {formatMoneyWhole(Math.round(100 * (1 + markup / 100)), currency)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Example for a {formatMoneyWhole(100, currency)} session
                </div>
              </div>
            </div>
          </div>

          {/* Markup slider — studios set their own markup (min 20%). */}
          {canManage ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Your marketplace markup</label>
                <span className="text-sm font-semibold tabular-nums">{markup}%</span>
              </div>
              <input
                type="range"
                min={MARKUP_FLOOR}
                max={MARKUP_CEILING}
                step={1}
                value={markup}
                onChange={(e) => setMarkup(Number(e.target.value))}
                className="w-full accent-primary"
                aria-label="Marketplace markup percentage"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Min {MARKUP_FLOOR}%</span>
                <span>Max {MARKUP_CEILING}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={saveMarkup} disabled={savingMarkup || markup === (prefs?.marketplace_markup_pct ?? -1)}>
                  {savingMarkup ? "Saving…" : "Save markup"}
                </Button>
                {markupSaved && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">
                    Saved
                  </Badge>
                )}
              </div>
            </div>
          ) : null}

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">How markup works:</span> You choose the
              markup Moovli adds on top of your session price (minimum {MARKUP_FLOOR}%, up to{" "}
              {MARKUP_CEILING}%). A higher markup means bookers pay more — your recommended baseline
              is {baseMarkup}%.
            </p>
            <p>
              <span className="font-medium text-foreground">Your earnings:</span> You always
              receive your full posted price in MAD. The markup is what Moovli keeps for
              providing customer acquisition, payment processing, and discovery.
            </p>
          </div>
        </section>
      )}

      {/* Coming soon */}
      <section className="rounded-xl border border-dashed p-5 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">Coming soon</p>
        <p>• Featured photo + tagline shown on your marketplace storefront</p>
        <p>• Highlight tags (&ldquo;First class free&rdquo;, &ldquo;Outdoor classes&rdquo;, etc.)</p>
        <p>• Quality metrics dashboard (rating, response time, completion rate)</p>
        <p>• Special offers + limited-time promotions</p>
      </section>

      <ChannelDeactivateSheet
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        entityId={entityId}
        channelType="marketplace"
        onDeactivated={handleDeactivated}
      />
    </BaseLayout>
  );
}
