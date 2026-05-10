"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  entityPlansApi,
  type EntityInvoice,
  type EntityPlan,
  type EntitySubscription,
} from "@/lib/api/entityPlans";
import { useAuth } from "@/lib/auth/provider";
import {
  AlertCircleIcon,
  CheckIcon,
  CreditCardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  InfoIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ============================================================================
// HELPERS
// ============================================================================

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const daysBetween = (from: Date, to: Date) =>
  Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

const STATUS_BADGE: Record<EntitySubscription["status"], { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  active: { variant: "default", label: "Active" },
  trialing: { variant: "secondary", label: "Trial" },
  past_due: { variant: "destructive", label: "Past due" },
  cancelled: { variant: "outline", label: "Cancelled" },
  paused: { variant: "outline", label: "Paused" },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StudioBillingPage() {
  const { roles } = useAuth();
  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const role = roles?.ownedEntities?.[0]?.role;
  const canManage = role === "owner" || role === "manager" || roles?.isAdmin;

  const [subscription, setSubscription] = useState<EntitySubscription | null>(null);
  const [activePlan, setActivePlan] = useState<EntityPlan | null>(null);
  const [invoices, setInvoices] = useState<EntityInvoice[]>([]);
  const [allPlans, setAllPlans] = useState<EntityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const [subRes, plansRes] = await Promise.all([
        entityPlansApi.getSubscription(entityId),
        entityPlansApi.listPlans(),
      ]);
      setSubscription(subRes.data.subscription);
      setActivePlan(subRes.data.plan);
      setInvoices(subRes.data.invoices);
      setAllPlans(plansRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const launchCheckout = async (planSlug: "standard" | "marketplace") => {
    if (!entityId) return;
    setActionLoading(planSlug);
    try {
      const baseUrl = window.location.origin;
      const { data } = await entityPlansApi.createCheckoutSession({
        entityId,
        planSlug,
        successUrl: `${baseUrl}/studio/billing?success=1`,
        cancelUrl: `${baseUrl}/studio/billing?cancelled=1`,
      });
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("Could not start checkout. Please try again.");
      setActionLoading(null);
    }
  };

  const launchPortal = async () => {
    if (!entityId) return;
    setActionLoading("portal");
    try {
      const { data } = await entityPlansApi.createPortalSession({
        entityId,
        returnUrl: `${window.location.origin}/studio/billing`,
      });
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("Could not open billing portal.");
      setActionLoading(null);
    }
  };

  if (!entityId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">No studio access found.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading billing…</div>;
  }

  // ==========================================================================
  // BANNERS
  // ==========================================================================

  const now = new Date();
  const trialEndDate = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const trialDaysLeft = trialEndDate ? daysBetween(now, trialEndDate) : null;
  const isTrialing = subscription?.status === "trialing";
  const isPastDue = subscription?.status === "past_due";
  const noCardOnTrial = isTrialing && !subscription?.stripe_subscription_id;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your studio's subscription, payment method, and invoices.
        </p>
      </div>

      {/* Trial-ending banner */}
      {noCardOnTrial && trialDaysLeft != null && trialDaysLeft <= 14 && (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertTitle>
            Your trial ends in {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            Add a payment method by {formatDate(subscription?.trial_end ?? null)} to keep your
            subscription active.
          </AlertDescription>
        </Alert>
      )}

      {/* Past-due banner */}
      {isPastDue && (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Payment failed</AlertTitle>
          <AlertDescription>
            We couldn't process your last payment. Update your payment method to keep your
            subscription active. Your account will be cancelled if all retries fail.
          </AlertDescription>
        </Alert>
      )}

      {/* Cancelled banner */}
      {subscription?.cancel_at_period_end && (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertTitle>Subscription scheduled to cancel</AlertTitle>
          <AlertDescription>
            Your subscription will end on {formatDate(subscription.current_period_end)}. You can
            reactivate any time before then in the billing portal.
          </AlertDescription>
        </Alert>
      )}

      {/* CURRENT PLAN */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>
                {activePlan
                  ? `${activePlan.name} — ${activePlan.price_mad} MAD / ${activePlan.billing_interval}`
                  : "No active plan"}
              </CardDescription>
            </div>
            {subscription && (
              <Badge variant={STATUS_BADGE[subscription.status].variant}>
                {STATUS_BADGE[subscription.status].label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {subscription.current_period_end && (
                <div>
                  <dt className="text-muted-foreground">Next bill</dt>
                  <dd>{formatDate(subscription.current_period_end)}</dd>
                </div>
              )}
              {subscription.trial_end && isTrialing && (
                <div>
                  <dt className="text-muted-foreground">Trial ends</dt>
                  <dd>{formatDate(subscription.trial_end)}</dd>
                </div>
              )}
              {subscription.payment_attempt_count != null && subscription.payment_attempt_count > 0 && (
                <div>
                  <dt className="text-muted-foreground">Payment attempts</dt>
                  <dd>{subscription.payment_attempt_count}/3</dd>
                </div>
              )}
            </dl>
          )}

          {canManage && subscription?.stripe_subscription_id && (
            <Button onClick={launchPortal} disabled={actionLoading === "portal"} variant="outline">
              <CreditCardIcon className="size-4 mr-2" />
              {actionLoading === "portal" ? "Opening…" : "Manage payment & subscription"}
              <ExternalLinkIcon className="size-3 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* PLAN CATALOG / UPGRADE */}
      {(noCardOnTrial || !subscription || subscription.status === "cancelled" || activePlan?.slug === "standard") && (
        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>
              {noCardOnTrial
                ? "Add a payment method to choose a plan"
                : "Choose a plan that fits your studio"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allPlans.map((plan) => {
                const isCurrent = activePlan?.slug === plan.slug;
                const isUpgrade = activePlan?.slug === "standard" && plan.slug === "marketplace";
                return (
                  <div
                    key={plan.id}
                    className={`rounded-lg border p-4 ${
                      isCurrent ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{plan.name}</h3>
                      {isCurrent && (
                        <Badge variant="default">
                          <CheckIcon className="size-3 mr-1" /> Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold mb-1">
                      {plan.price_mad} <span className="text-sm font-normal text-muted-foreground">MAD/mo</span>
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                    <ul className="space-y-1 text-xs mb-4">
                      {plan.allowed_channel_types.includes("marketplace") && (
                        <li className="flex items-start gap-1">
                          <CheckIcon className="size-3 mt-0.5 text-emerald-600" />
                          Marketplace listing
                        </li>
                      )}
                      <li className="flex items-start gap-1">
                        <CheckIcon className="size-3 mt-0.5 text-emerald-600" />
                        Public booking page
                      </li>
                      <li className="flex items-start gap-1">
                        <CheckIcon className="size-3 mt-0.5 text-emerald-600" />
                        Custom calendar links
                      </li>
                      <li className="flex items-start gap-1">
                        <CheckIcon className="size-3 mt-0.5 text-emerald-600" />
                        Embeddable widget
                      </li>
                    </ul>
                    {!isCurrent && canManage && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => launchCheckout(plan.slug)}
                        disabled={actionLoading === plan.slug}
                      >
                        {actionLoading === plan.slug
                          ? "Loading…"
                          : isUpgrade
                            ? "Upgrade"
                            : "Choose plan"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* INVOICES */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Billing history</CardTitle>
            <CardDescription>{invoices.length} invoice{invoices.length === 1 ? "" : "s"}</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-b-0">
                    <td className="py-2">{formatDate(inv.paid_at ?? inv.created_at)}</td>
                    <td className="py-2 font-medium">
                      {inv.amount_mad} {inv.currency}
                    </td>
                    <td className="py-2">
                      <Badge variant={inv.status === "paid" ? "default" : "outline"}>
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      {inv.invoice_pdf_url && (
                        <a
                          href={inv.invoice_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <DownloadIcon className="size-3" /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
