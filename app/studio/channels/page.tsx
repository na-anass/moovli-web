"use client";

import { StudioPage } from "@/components/layout/studio-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { channelsApi, type Channel } from "@/lib/api/channels";
import { entityPlansApi, type EntityPlan } from "@/lib/api/entityPlans";
import { studioApi, type ChannelPrefs } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LockIcon,
  Settings2Icon,
  ShoppingBagIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PUBLIC_BOOKING_BASE =
  process.env.NEXT_PUBLIC_BOOKING_BASE_URL || "https://booking.moovli.app";
const IS_SUBDOMAIN_BASE = /\/\/booking\./.test(PUBLIC_BOOKING_BASE);

const directHostedUrl = (slug: string): string =>
  IS_SUBDOMAIN_BASE
    ? `${PUBLIC_BOOKING_BASE}/${slug}`
    : `${PUBLIC_BOOKING_BASE}/booking/${slug}`;

type ChannelKey = "marketplace" | "direct_hosted";

export default function StudioChannelsPage() {
  const { roles } = useAuth();
  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const role = roles?.ownedEntities?.[0]?.role;
  const canManage = role === "owner" || role === "manager" || roles?.isAdmin;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activePlan, setActivePlan] = useState<EntityPlan | null>(null);
  const [prefs, setPrefs] = useState<ChannelPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [savingPref, setSavingPref] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const [chRes, subRes, prefRes] = await Promise.all([
        channelsApi.listForEntity(entityId),
        entityPlansApi.getSubscription(entityId),
        studioApi.getChannelPrefs(entityId),
      ]);
      setChannels(chRes.data);
      setActivePlan(subRes.data.plan);
      setPrefs(prefRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const togglePref = async (key: keyof ChannelPrefs, value: boolean) => {
    if (!entityId || !prefs) return;
    setSavingPref(key);
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    try {
      const res = await studioApi.updateChannelPrefs(entityId, { [key]: value });
      setPrefs(res.data);
    } catch (e) {
      console.error(e);
      setPrefs(previous);
    } finally {
      setSavingPref(null);
    }
  };

  const planAllows = (type: ChannelKey): boolean =>
    !!activePlan?.allowed_channel_types.includes(type);

  const marketplaceAllowed = planAllows("marketplace");
  const marketplaceOn = !!prefs?.marketplace_enabled;
  const marketplaceLive = marketplaceAllowed && marketplaceOn;

  const directHosted = channels.find((c) => c.type === "direct_hosted");
  const directAllowed = planAllows("direct_hosted");
  const directOn = !!prefs?.direct_hosted_enabled;
  const directLive = directAllowed && directOn && !!directHosted;

  const copyHostedUrl = () => {
    if (!directHosted) return;
    navigator.clipboard.writeText(directHostedUrl(directHosted.slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">No studio access found.</div>;
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading channels…</div>;
  }

  return (
    <StudioPage
      maxWidth="lg"
      gap="loose"
      title="Channels"
      subtitle="Choose where bookers can discover and book your sessions. Each channel can be customized on its own page."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {/* MARKETPLACE CARD */}
        <ChannelCard
          icon={ShoppingBagIcon}
          accent="violet"
          title="Marketplace"
          subtitle="Discoverable in the Moovli app"
          live={marketplaceLive}
          locked={!marketplaceAllowed}
          status={
            !marketplaceAllowed
              ? { label: "Plan upgrade required", tone: "locked" }
              : marketplaceLive
                ? { label: "Active", tone: "on" }
                : { label: "Off", tone: "off" }
          }
          toggle={
            marketplaceAllowed && canManage
              ? {
                  checked: marketplaceOn,
                  onChange: (v) => togglePref("marketplace_enabled", v),
                  saving: savingPref === "marketplace_enabled",
                }
              : undefined
          }
          rows={[
            marketplaceAllowed
              ? {
                  label: "Markup",
                  value: `~${Math.round(Number(activePlan?.base_markup_pct ?? 0))}% baseline · dynamic`,
                }
              : null,
            marketplaceAllowed
              ? {
                  label: "Earnings",
                  value: "You always receive your full session price",
                }
              : null,
            !marketplaceAllowed
              ? {
                  label: "Current plan",
                  value: `${activePlan?.name ?? "Standard"} — marketplace not included`,
                }
              : null,
          ]}
          footer={
            !marketplaceAllowed && canManage ? (
              <Link
                href="/studio/billing"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Upgrade to Marketplace plan
                <ArrowRightIcon className="size-3.5" />
              </Link>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/studio/channels/marketplace">
                  <Settings2Icon className="size-3.5 mr-1.5" />
                  Customize
                </Link>
              </Button>
            )
          }
        />

        {/* DIRECT CARD */}
        <ChannelCard
          icon={GlobeIcon}
          accent="emerald"
          title="Direct booking page"
          subtitle="Your studio's hosted public page"
          live={directLive}
          locked={!directAllowed}
          status={
            !directAllowed
              ? { label: "Plan required", tone: "locked" }
              : directLive
                ? { label: "Active", tone: "on" }
                : { label: "Off", tone: "off" }
          }
          toggle={
            directAllowed && canManage
              ? {
                  checked: directOn,
                  onChange: (v) => togglePref("direct_hosted_enabled", v),
                  saving: savingPref === "direct_hosted_enabled",
                }
              : undefined
          }
          rows={[
            directLive && directHosted
              ? {
                  label: "URL",
                  value: (
                    <code className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono break-all">
                      {directHostedUrl(directHosted.slug)}
                    </code>
                  ),
                }
              : null,
            { label: "Payment", value: "Reservation-only — bookers pay at studio" },
            { label: "Guests", value: "Anyone with the link can book — no account needed" },
          ]}
          footer={
            <div className="flex flex-wrap gap-2 items-center">
              <Button asChild variant="outline" size="sm">
                <Link href="/studio/channels/direct">
                  <Settings2Icon className="size-3.5 mr-1.5" />
                  Customize
                </Link>
              </Button>
              {directLive && directHosted && (
                <>
                  <Button variant="ghost" size="sm" onClick={copyHostedUrl}>
                    {copied ? (
                      <>
                        <CheckIcon className="size-3.5 mr-1.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3.5 mr-1.5" />
                        Copy link
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={directHostedUrl(directHosted.slug)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLinkIcon className="size-3.5 mr-1.5" />
                      Preview
                    </a>
                  </Button>
                </>
              )}
            </div>
          }
        />
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">How publishing works</CardTitle>
          <CardDescription>
            New sessions are automatically offered on every active channel. You can opt-out
            per session from the session form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• Marketplace bookings are paid via Moovli — you receive payouts</li>
            <li>• Direct page bookings are reservations — payment happens at your studio</li>
            <li>• Turning a channel off hides it everywhere — existing bookings are unaffected</li>
          </ul>
        </CardContent>
      </Card>
    </StudioPage>
  );
}

// ============================================================================
// Channel card
// ============================================================================

type StatusTone = "on" | "off" | "locked";

const STATUS_TONE: Record<
  StatusTone,
  { badgeClass: string; dotClass: string; icon?: React.ElementType }
> = {
  on: {
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  off: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground/40",
  },
  locked: {
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    dotClass: "",
    icon: LockIcon,
  },
};

const ACCENT_TONE: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

interface ChannelCardProps {
  icon: React.ElementType;
  accent: "violet" | "emerald";
  title: string;
  subtitle: string;
  live: boolean;
  locked: boolean;
  status: { label: string; tone: StatusTone };
  toggle?: { checked: boolean; onChange: (v: boolean) => void; saving: boolean };
  rows: (null | { label: string; value: React.ReactNode })[];
  footer?: React.ReactNode;
}

function ChannelCard({
  icon: Icon,
  accent,
  title,
  subtitle,
  live,
  locked,
  status,
  toggle,
  rows,
  footer,
}: ChannelCardProps) {
  const tone = STATUS_TONE[status.tone];
  const StatusIcon = tone.icon;

  return (
    <div
      className={`relative rounded-xl border bg-card p-5 transition ${
        live ? "shadow-sm" : locked ? "opacity-85" : "opacity-95"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${ACCENT_TONE[accent]}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base">{title}</h2>
            <Badge
              variant="outline"
              className={`text-[10px] py-0 px-1.5 gap-1 ${tone.badgeClass}`}
            >
              {StatusIcon ? (
                <StatusIcon className="size-2.5" />
              ) : tone.dotClass ? (
                <span className={`size-1.5 rounded-full ${tone.dotClass}`} />
              ) : null}
              {status.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {toggle && (
          <Switch
            checked={toggle.checked}
            disabled={toggle.saving}
            onCheckedChange={toggle.onChange}
            aria-label={`Toggle ${title}`}
          />
        )}
      </div>

      {/* Rows */}
      <dl className="mt-4 space-y-1.5 border-t pt-3">
        {rows.filter(Boolean).map((row, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <dt className="text-muted-foreground shrink-0 w-20">{row!.label}</dt>
            <dd className="flex-1 min-w-0 text-foreground">{row!.value}</dd>
          </div>
        ))}
      </dl>

      {/* Footer actions */}
      {footer && <div className="mt-4 pt-3 border-t flex items-center">{footer}</div>}
    </div>
  );
}
