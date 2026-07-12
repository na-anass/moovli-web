"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { ChannelDeactivateSheet } from "@/components/studio/channel-deactivate-sheet";
import { formatMoneyWhole } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MarketplaceFaq, type FaqItem } from "./marketplace-faq";
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

  // Studio-set discount to Moovli. Floor 20%, no upper cap.
  const DISCOUNT_FLOOR = 20;
  const [markup, setMarkup] = useState<number>(DISCOUNT_FLOOR);
  const [savingMarkup, setSavingMarkup] = useState(false);
  const [markupSaved, setMarkupSaved] = useState(false);
  // Inline validation: below the floor is not allowed (no silent clamping).
  const belowFloor = markup < DISCOUNT_FLOOR;

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
      // Initialize from the studio's saved discount, falling back to the plan's
      // baseline (clamped to the allowed floor).
      const saved = prefRes.data.marketplace_markup_pct;
      const baseline = Math.round(Number(subRes.data.plan?.base_markup_pct ?? DISCOUNT_FLOOR));
      setMarkup(Math.max(DISCOUNT_FLOOR, saved ?? baseline));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  const saveMarkup = async () => {
    if (!entityId) return;
    const value = Math.round(markup);
    // Guard: never submit a value below the floor (button is also disabled).
    if (!value || value < DISCOUNT_FLOOR) return;
    setSavingMarkup(true);
    setMarkupSaved(false);
    try {
      const res = await studioApi.updateChannelPrefs(entityId, { marketplace_markup_pct: value });
      setMarkup(value);
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

  const faqItems: FaqItem[] = [
    {
      question: `Pourquoi un discount de ${DISCOUNT_FLOOR}% ?`,
      answer:
        "C'est ce qui rend l'offre attractive pour les clients abonnés. En échange, vous touchez de nouveaux clients sans effort marketing.",
    },
    {
      question: "Est-ce que mes clients actuels vont passer par le marketplace ?",
      answer:
        "Non. Vos clients réguliers continuent de réserver via votre lien direct au prix normal.",
    },
    {
      question: "Je peux retirer un cours du marketplace à tout moment ?",
      answer: "Oui. Vous gardez le contrôle total.",
    },
    {
      question: "Comment ça marche ?",
      answer: `Votre discount est la remise en gros que vous accordez à Moovli (minimum ${DISCOUNT_FLOOR}%). Moovli affiche votre session sur le marketplace à son propre prix — fixé dynamiquement selon le moment et la demande — et garde la différence. Base recommandée : ${baseMarkup}%.`,
    },
    {
      question: "Combien je touche ?",
      answer:
        "Vous recevez toujours votre net — votre prix de vente moins votre discount — quel que soit le prix auquel Moovli le vend. Le discount couvre l'acquisition client, le traitement des paiements et la découverte.",
    },
  ];

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
                app users — you set a list price and a wholesale discount, and receive the net
                on every marketplace booking.
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

      {/* Pricing on the marketplace — calculation + input on a card */}
      {planAllows && (
        <Card className="gap-4 p-5">
          <div className="flex items-center gap-2">
            <CoinsIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Pricing on the marketplace</h2>
          </div>

          <div className="rounded-lg bg-muted/40 p-4">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Your list price
                </div>
                <div className="text-xl font-semibold mt-0.5">{formatMoneyWhole(100, currency)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  You set this
                </div>
              </div>
              <div className="text-muted-foreground">−</div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Discount to Moovli
                </div>
                <div className="text-xl font-semibold mt-0.5">{markup}%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Your wholesale discount
                </div>
              </div>
              <div className="text-muted-foreground">=</div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  You receive
                </div>
                <div className="text-xl font-semibold mt-0.5 text-primary">
                  {formatMoneyWhole(Math.round(100 * (1 - markup / 100)), currency)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Net, for a {formatMoneyWhole(100, currency)} session
                </div>
              </div>
            </div>
          </div>

          {/* Studio sets its own discount — minimum 20%, no upper cap. */}
          {canManage ? (
            <div className="space-y-2">
              <label className="text-xs font-medium" htmlFor="markup-input">
                Your discount to Moovli
              </label>
              <div className="flex items-center gap-2">
                <div className="relative w-32">
                  <Input
                    id="markup-input"
                    type="number"
                    min={DISCOUNT_FLOOR}
                    step={1}
                    value={markup}
                    onChange={(e) => setMarkup(Number(e.target.value))}
                    aria-invalid={belowFloor}
                    className="pr-7"
                    aria-label="Marketplace discount percentage"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={saveMarkup}
                  disabled={
                    savingMarkup ||
                    belowFloor ||
                    markup === (prefs?.marketplace_markup_pct ?? -1)
                  }
                >
                  {savingMarkup ? "Saving…" : "Save discount"}
                </Button>
                {markupSaved && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">
                    Saved
                  </Badge>
                )}
              </div>
              {belowFloor ? (
                <p className="text-[11px] font-medium text-destructive">
                  Minimum discount is {DISCOUNT_FLOOR}%.
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Minimum {DISCOUNT_FLOOR}% — no maximum.
                </p>
              )}
            </div>
          ) : null}
        </Card>
      )}

      {/* FAQ */}
      {planAllows && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Questions fréquentes</h2>
          <MarketplaceFaq items={faqItems} />
        </section>
      )}

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
