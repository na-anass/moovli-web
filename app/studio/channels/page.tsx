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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { channelsApi, type Channel, type ChannelType } from "@/lib/api/channels";
import { entityPlansApi, type EntityPlan } from "@/lib/api/entityPlans";
import { useAuth } from "@/lib/auth/provider";
import {
  CodeIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LinkIcon,
  LockIcon,
  PlusIcon,
  ShoppingBagIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const PUBLIC_BOOKING_BASE = process.env.NEXT_PUBLIC_BOOKING_BASE_URL || "https://booking.moovli.app";

const TYPE_META: Record<ChannelType, { icon: typeof GlobeIcon; label: string; description: string }> = {
  marketplace: {
    icon: ShoppingBagIcon,
    label: "Marketplace",
    description: "Discoverable on the Moovli mobile app feed",
  },
  direct_hosted: {
    icon: GlobeIcon,
    label: "Booking page",
    description: "Your studio's hosted public booking page",
  },
  direct_link: {
    icon: LinkIcon,
    label: "Custom link",
    description: "Filtered Calendly-style link for partners or campaigns",
  },
  direct_embed: {
    icon: CodeIcon,
    label: "Embed widget",
    description: "Drop a booking widget on your own website",
  },
};

const channelUrl = (channel: Channel): string => {
  if (channel.type === "marketplace") return "Moovli mobile app";
  if (channel.type === "direct_hosted") return `${PUBLIC_BOOKING_BASE}/${channel.slug}`;
  if (channel.type === "direct_link") return `${PUBLIC_BOOKING_BASE}/c/${channel.slug}`;
  if (channel.type === "direct_embed") return `${PUBLIC_BOOKING_BASE}/embed/${channel.slug}`;
  return "";
};

const embedSnippet = (channel: Channel): string =>
  `<iframe src="${channelUrl(channel)}" width="100%" height="640" frameborder="0" style="border:0;border-radius:8px;"></iframe>`;

export default function StudioChannelsPage() {
  const { roles } = useAuth();
  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const role = roles?.ownedEntities?.[0]?.role;
  const canManage = role === "owner" || role === "manager" || roles?.isAdmin;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [plans, setPlans] = useState<EntityPlan[]>([]);
  const [activePlan, setActivePlan] = useState<EntityPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"direct_link" | "direct_embed">("direct_link");
  const [createForm, setCreateForm] = useState({ slug: "", label: "" });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const [chRes, plansRes, subRes] = await Promise.all([
        channelsApi.listForEntity(entityId),
        entityPlansApi.listPlans(),
        entityPlansApi.getSubscription(entityId),
      ]);
      setChannels(chRes.data);
      setPlans(plansRes.data);
      setActivePlan(subRes.data.plan);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const planAllows = (type: ChannelType): boolean => {
    if (!activePlan) return false;
    return activePlan.allowed_channel_types.includes(type);
  };

  // Group existing channels by type
  const marketplaceChannel = channels.find((c) => c.type === "marketplace");
  const hostedChannel = channels.find((c) => c.type === "direct_hosted");
  const customLinks = channels.filter((c) => c.type === "direct_link");
  const embedChannels = channels.filter((c) => c.type === "direct_embed");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openCreate = (type: "direct_link" | "direct_embed") => {
    setCreateType(type);
    setCreateForm({ slug: "", label: "" });
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!entityId) return;
    setSaving(true);
    try {
      await channelsApi.create({
        entityId,
        type: createType,
        slug: createForm.slug.toLowerCase(),
        label: createForm.label,
      });
      setCreateDialogOpen(false);
      fetchAll();
    } catch (e: unknown) {
      const message = (e as Error).message || "Failed to create channel";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (channel: Channel) => {
    if (!confirm(`Delete "${channel.label}"? This cannot be undone.`)) return;
    try {
      await channelsApi.delete(channel.id);
      fetchAll();
    } catch (e) {
      console.error(e);
      alert("Failed to delete channel");
    }
  };

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">No studio access found.</div>;
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading channels…</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Channels</h1>
        <p className="text-sm text-muted-foreground">
          Where your sessions can be discovered and booked.
        </p>
      </div>

      {/* MARKETPLACE */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <ShoppingBagIcon className="size-5 mt-1 text-primary" />
              <div>
                <CardTitle>Marketplace</CardTitle>
                <CardDescription>Discoverable on the Moovli mobile app · 10K+ users</CardDescription>
              </div>
            </div>
            {planAllows("marketplace") && marketplaceChannel ? (
              <Badge variant="default">Active</Badge>
            ) : (
              <Badge variant="outline">
                <LockIcon className="size-3 mr-1" />
                {planAllows("marketplace") ? "Inactive" : "Locked"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!planAllows("marketplace") ? (
            <div className="text-sm">
              <p className="text-muted-foreground mb-3">
                Reach 10,000+ Moovli users. Upgrade to Marketplace plan to enable.
              </p>
              {canManage && (
                <a
                  href="/studio/billing"
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Upgrade to Marketplace plan →
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Moovli applies a small platform margin on marketplace bookings.
              You always receive your full session price.
            </p>
          )}
        </CardContent>
      </Card>

      {/* DIRECT — HOSTED PAGE */}
      {hostedChannel && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <GlobeIcon className="size-5 mt-1 text-primary" />
                <div>
                  <CardTitle>Direct booking page</CardTitle>
                  <CardDescription>Your hosted public booking page</CardDescription>
                </div>
              </div>
              <Badge variant="secondary">Default</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <code className="text-xs flex-1 truncate">{channelUrl(hostedChannel)}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(channelUrl(hostedChannel))}
              >
                <CopyIcon className="size-3" />
              </Button>
              <a
                href={channelUrl(hostedChannel)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs text-primary hover:underline"
              >
                <ExternalLinkIcon className="size-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DIRECT — CUSTOM LINKS */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <LinkIcon className="size-5 mt-1 text-primary" />
              <div>
                <CardTitle>Custom links</CardTitle>
                <CardDescription>
                  Calendly-style URLs for partners, campaigns, or VIP bookings
                </CardDescription>
              </div>
            </div>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => openCreate("direct_link")}>
                <PlusIcon className="size-3 mr-1" /> New link
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {customLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom links yet.</p>
          ) : (
            <div className="space-y-3">
              {customLinks.map((c) => (
                <div key={c.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{c.label}</div>
                      <code className="text-xs text-muted-foreground">{channelUrl(c)}</code>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(channelUrl(c))}>
                        <CopyIcon className="size-3" />
                      </Button>
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(c)}>
                          <Trash2Icon className="size-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIRECT — EMBEDDABLE WIDGET */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CodeIcon className="size-5 mt-1 text-primary" />
              <div>
                <CardTitle>Embeddable widget</CardTitle>
                <CardDescription>Add a booking widget to your own website</CardDescription>
              </div>
            </div>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => openCreate("direct_embed")}>
                <PlusIcon className="size-3 mr-1" /> New widget
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {embedChannels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a widget to embed your bookable sessions on any website.
            </p>
          ) : (
            <div className="space-y-3">
              {embedChannels.map((c) => (
                <div key={c.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-sm">{c.label}</div>
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(c)}>
                        <Trash2Icon className="size-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="rounded bg-muted/50 p-2 font-mono text-[11px] overflow-x-auto">
                    {embedSnippet(c)}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(embedSnippet(c))}>
                    <CopyIcon className="size-3 mr-1" /> Copy snippet
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TYPE_META[createType].label} — new</DialogTitle>
            <DialogDescription>{TYPE_META[createType].description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Internal label</label>
              <Input
                placeholder="e.g. Hotel Marina partnership"
                value={createForm.label}
                onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">URL slug</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {createType === "direct_link" ? "/c/" : "/embed/"}
                </span>
                <Input
                  placeholder="marina"
                  value={createForm.slug}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!createForm.label || !createForm.slug || saving}
              onClick={handleCreate}
            >
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
