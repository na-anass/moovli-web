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
  CheckIcon,
  CoinsIcon,
  InfoIcon,
  LockIcon,
  PercentIcon,
  ShoppingBagIcon,
  TagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

  // Worked example used to illustrate the payout math on the pricing card.
  const EXAMPLE_PRICE = 100;
  const exampleNet = Math.round(EXAMPLE_PRICE * (1 - markup / 100));
  const youKeepPct = Math.max(0, 100 - markup);
  const DISCOUNT_PRESETS = [20, 25, 30, 40];

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
      question: `Why a ${DISCOUNT_FLOOR}% discount?`,
      answer:
        "It's what makes the offer attractive to subscribed members. In exchange, you reach new customers with no marketing effort.",
    },
    {
      question: "Will my existing clients go through the marketplace?",
      answer:
        "No. Your regular clients keep booking through your direct link at your normal price.",
    },
    {
      question: "Can I remove a class from the marketplace anytime?",
      answer: "Yes. You stay in full control.",
    },
    {
      question: "How does it work?",
      answer: `Your discount is the wholesale rate you give Moovli (minimum ${DISCOUNT_FLOOR}%). Moovli lists your session on the marketplace at its own price — set dynamically based on timing and demand — and keeps the difference. Recommended baseline: ${baseMarkup}%.`,
    },
    {
      question: "How much do I earn?",
      answer:
        "You always receive your net — your list price minus your discount — no matter what price Moovli sells it at. The discount covers customer acquisition, payment processing, and discovery.",
    },
  ];

  return (
    <BaseLayout
      icon={ShoppingBagIcon}
      iconAccent="violet"
      title="Marketplace"
      subtitle="Your sessions discoverable in the Moovli mobile app."
      maxWidth="xl"
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

      {/* Plan-allowed content: main column + FAQ sidebar on desktop */}
      {planAllows && (
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          {/* Main column */}
          <div className="space-y-6 lg:col-span-2">
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

            {/* Pricing on the marketplace — calculation + input on a card */}
            <Card className="gap-0 overflow-hidden p-0">
          {/* Header band */}
          <div className="flex items-start justify-between gap-3 border-b bg-linear-to-r from-primary/5 to-transparent px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CoinsIcon className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Pricing on the marketplace</h2>
                <p className="text-xs text-muted-foreground">
                  You set your list price — Moovli takes a wholesale discount.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="hidden shrink-0 items-center gap-1 sm:flex">
              <TagIcon className="size-3" /> Wholesale
            </Badge>
          </div>

          {/* Payout math — icon-driven flow */}
          <div className="px-5 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <PriceTile
                icon={<TagIcon className="size-4" />}
                tint="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                label="Your list price"
                value={formatMoneyWhole(EXAMPLE_PRICE, currency)}
                sub="You set this"
              />
              <Operator symbol="−" />
              <PriceTile
                icon={<TrendingDownIcon className="size-4" />}
                tint="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                label="Discount to Moovli"
                value={`${markup}%`}
                sub="Your wholesale rate"
              />
              <Operator symbol="=" />
              <PriceTile
                highlight
                icon={<WalletIcon className="size-4" />}
                tint="bg-primary/15 text-primary"
                label="You receive"
                value={formatMoneyWhole(exampleNet, currency)}
                sub={`Net · you keep ${youKeepPct}%`}
              />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <InfoIcon className="size-3 shrink-0" />
              Example for a {formatMoneyWhole(EXAMPLE_PRICE, currency)} session — your payout
              scales with each price.
            </p>
          </div>

          {/* Studio sets its own discount — minimum 20%, no upper cap. */}
          {canManage && (
            <div className="border-t bg-muted/20 px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label
                  className="flex items-center gap-1.5 text-xs font-medium"
                  htmlFor="markup-input"
                >
                  <PercentIcon className="size-3.5 text-muted-foreground" />
                  Your discount to Moovli
                </label>
                <span className="text-xs text-muted-foreground">
                  You keep <strong className="text-foreground">{youKeepPct}%</strong>
                </span>
              </div>

              {/* Quick presets */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {DISCOUNT_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setMarkup(p)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition hover:bg-accent",
                      markup === p
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {p}%
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-32">
                  <PercentIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="markup-input"
                    type="number"
                    min={DISCOUNT_FLOOR}
                    step={1}
                    value={markup}
                    onChange={(e) => setMarkup(Number(e.target.value))}
                    aria-invalid={belowFloor}
                    className="pl-8 pr-7"
                    aria-label="Marketplace discount percentage"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
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
                  {savingMarkup ? (
                    "Saving…"
                  ) : (
                    <>
                      <CheckIcon className="mr-1 size-3.5" /> Save discount
                    </>
                  )}
                </Button>
                {markupSaved && (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                  >
                    Saved
                  </Badge>
                )}
              </div>

              {belowFloor ? (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
                  <InfoIcon className="size-3" /> Minimum discount is {DISCOUNT_FLOOR}%.
                </p>
              ) : (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Minimum {DISCOUNT_FLOOR}% — no maximum.
                </p>
              )}
            </div>
          )}
            </Card>
          </div>

          {/* FAQ sidebar — right column on desktop */}
          <aside className="space-y-3 lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold">FAQs</h2>
            <MarketplaceFaq items={faqItems} />
          </aside>
        </div>
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

// ── Pricing card helpers ─────────────────────────────────────────────────────

/** One tile in the payout-math flow (list price / discount / net). */
function PriceTile({
  icon,
  tint,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center gap-1.5 rounded-xl border bg-background px-3 py-4 text-center",
        highlight && "border-primary/40 bg-primary/5 shadow-sm",
      )}
    >
      <span className={cn("flex size-8 items-center justify-center rounded-full", tint)}>
        {icon}
      </span>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold", highlight && "text-primary")}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

/** The − / = glyph sitting between two price tiles. */
function Operator({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center justify-center sm:px-0.5">
      <span className="flex size-6 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground">
        {symbol}
      </span>
    </div>
  );
}
