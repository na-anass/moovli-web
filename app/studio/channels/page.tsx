"use client";

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
import { channelsApi, type Channel, type ChannelType } from "@/lib/api/channels";
import { entityPlansApi, type EntityPlan } from "@/lib/api/entityPlans";
import { studioApi, type ChannelPrefs } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LockIcon,
  ShoppingBagIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PUBLIC_BOOKING_BASE = process.env.NEXT_PUBLIC_BOOKING_BASE_URL || "https://booking.moovli.app";
const IS_SUBDOMAIN_BASE = /\/\/booking\./.test(PUBLIC_BOOKING_BASE);

const directHostedUrl = (slug: string): string =>
  IS_SUBDOMAIN_BASE
    ? `${PUBLIC_BOOKING_BASE}/${slug}`
    : `${PUBLIC_BOOKING_BASE}/booking/${slug}`;

export default function StudioChannelsPage() {
  const { roles } = useAuth();
  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const role = roles?.ownedEntities?.[0]?.role;
  const canManage = role === "owner" || role === "manager" || roles?.isAdmin;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activePlan, setActivePlan] = useState<EntityPlan | null>(null);
  const [prefs, setPrefs] = useState<ChannelPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
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

  const togglePref = async (key: keyof ChannelPrefs, value: boolean) => {
    if (!entityId || !prefs) return;
    setSavingPref(key);
    setPrefs({ ...prefs, [key]: value }); // optimistic
    try {
      const res = await studioApi.updateChannelPrefs(entityId, { [key]: value });
      setPrefs(res.data);
    } catch (e) {
      console.error(e);
      // revert on error
      setPrefs(prefs);
    } finally {
      setSavingPref(null);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const planAllows = (type: ChannelType): boolean =>
    !!activePlan?.allowed_channel_types.includes(type);

  // Marketplace is a singleton — plan must allow it AND studio hasn't disabled it.
  const marketplaceAllowedByPlan = planAllows("marketplace");
  const marketplaceTurnedOn = !!prefs?.marketplace_enabled;
  const marketplaceLive = marketplaceAllowedByPlan && marketplaceTurnedOn;

  const directHosted = channels.find((c) => c.type === "direct_hosted");
  const directAllowedByPlan = planAllows("direct_hosted");
  const directTurnedOn = !!prefs?.direct_hosted_enabled;
  const directLive = directAllowedByPlan && directTurnedOn;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">No studio access found.</div>;
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading channels…</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Channels</h1>
        <p className="text-sm text-muted-foreground">
          Where your sessions are visible to bookers.
        </p>
      </div>

      <div className="rounded-lg border divide-y">
        {/* MARKETPLACE */}
        <ChannelRow
          icon={ShoppingBagIcon}
          title="Marketplace"
          subtitle="Discoverable on the Moovli mobile app"
          live={marketplaceLive}
          status={
            !marketplaceAllowedByPlan
              ? { label: "Plan upgrade required", variant: "outline", icon: LockIcon }
              : marketplaceLive
                ? { label: "On", variant: "default" }
                : { label: "Off", variant: "outline" }
          }
          toggle={
            marketplaceAllowedByPlan && canManage
              ? {
                  checked: marketplaceTurnedOn,
                  onChange: (v) => togglePref("marketplace_enabled", v),
                  saving: savingPref === "marketplace_enabled",
                }
              : undefined
          }
          extra={
            !marketplaceAllowedByPlan && canManage ? (
              <Link
                href="/studio/billing"
                className="inline-flex items-center text-xs text-primary font-medium hover:underline"
              >
                Upgrade to Marketplace plan →
              </Link>
            ) : marketplaceLive ? (
              <p className="text-xs text-muted-foreground">
                Moovli adds a small platform margin on marketplace bookings · You always
                receive your full session price.
              </p>
            ) : null
          }
        />

        {/* DIRECT BOOKING PAGE */}
        {directHosted && (
          <ChannelRow
            icon={GlobeIcon}
            title="Direct booking page"
            subtitle="Your studio's hosted public booking page"
            live={directLive}
            status={
              !directAllowedByPlan
                ? { label: "Plan required", variant: "outline", icon: LockIcon }
                : directLive
                  ? { label: "On", variant: "default" }
                  : { label: "Off", variant: "outline" }
            }
            toggle={
              directAllowedByPlan && canManage
                ? {
                    checked: directTurnedOn,
                    onChange: (v) => togglePref("direct_hosted_enabled", v),
                    saving: savingPref === "direct_hosted_enabled",
                  }
                : undefined
            }
            extra={
              directLive ? (
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 truncate text-xs rounded bg-muted/50 px-2 py-1.5">
                    {directHostedUrl(directHosted.slug)}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyToClipboard(directHostedUrl(directHosted.slug), "hosted")
                    }
                    title="Copy link"
                  >
                    {copied === "hosted" ? (
                      <CheckIcon className="size-3.5 text-emerald-600" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    title="Open in new tab"
                  >
                    <a
                      href={directHostedUrl(directHosted.slug)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLinkIcon className="size-3.5" />
                    </a>
                  </Button>
                </div>
              ) : null
            }
          />
        )}
      </div>

      {/* HOW IT WORKS */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">How session publishing works</CardTitle>
          <CardDescription>
            New sessions you create are automatically published to every channel you have
            active. To opt-out of one for a specific session, use the channel toggles in the
            session form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• Marketplace bookings are paid via Moovli (you receive payouts)</li>
            <li>• Direct booking page reservations are paid at your studio</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Channel row component
// ============================================================================

interface StatusBadge {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  icon?: React.ElementType;
}

function ChannelRow({
  icon: Icon,
  title,
  subtitle,
  live,
  status,
  toggle,
  extra,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  live: boolean;
  status: StatusBadge;
  toggle?: { checked: boolean; onChange: (v: boolean) => void; saving: boolean };
  extra?: React.ReactNode;
}) {
  return (
    <div className={`p-4 ${live ? "" : "opacity-70"}`}>
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md ${
            live ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{title}</span>
            <Badge variant={status.variant} className="text-[10px] py-0 px-1.5">
              {status.icon && <status.icon className="size-2.5 mr-0.5" />}
              {status.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          {extra && <div className="mt-2">{extra}</div>}
        </div>
        {toggle && (
          <Switch
            checked={toggle.checked}
            disabled={toggle.saving}
            onCheckedChange={toggle.onChange}
          />
        )}
      </div>
    </div>
  );
}
