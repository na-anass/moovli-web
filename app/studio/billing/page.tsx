"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { formatMoneyWhole } from "@/lib/money";
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
import { useActiveEntity } from "@/lib/studio/active-entity";
import {
  AlertCircleIcon,
  CheckIcon,
  CreditCardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  InfoIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatDateLong } from "@/lib/datetime";
import { InfoTip } from "@/components/ui/info-tip";
import { useTranslations } from "next-intl";

const daysBetween = (from: Date, to: Date) =>
  Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

const STATUS_BADGE: Record<
  EntitySubscription["status"],
  { variant: "default" | "secondary" | "destructive" | "outline"; labelKey: string }
> = {
  active: { variant: "default", labelKey: "statusActive" },
  trialing: { variant: "secondary", labelKey: "statusTrial" },
  past_due: { variant: "destructive", labelKey: "statusPastDue" },
  cancelled: { variant: "outline", labelKey: "statusCancelled" },
  paused: { variant: "outline", labelKey: "statusPaused" },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StudioBillingPage() {
  const t = useTranslations("studioChannels.billing");
  const tc = useTranslations("common");
  const activeEntity = useActiveEntity();
  const currency = activeEntity.currencyCode;
  const entityId = activeEntity.entityId;
  const role = activeEntity.role;
  const canManage = role === "owner" || role === "manager";

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
      alert(t("checkoutError"));
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
      alert(t("portalError"));
      setActionLoading(null);
    }
  };

  if (!entityId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">{t("noAccess")}</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">{t("loadingBilling")}</div>;
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
    <BaseLayout
      maxWidth="lg"
      title={t("title")}
      subtitle={t("subtitle")}
    >

      {/* Trial-ending banner */}
      {noCardOnTrial && trialDaysLeft != null && trialDaysLeft <= 14 && (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertTitle>
            {t("trialEndsIn", { days: trialDaysLeft })}
          </AlertTitle>
          <AlertDescription>
            {t("trialEndsBody", {
              date: formatDateLong(subscription?.trial_end ?? null),
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Past-due banner */}
      {isPastDue && (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>{t("paymentFailedTitle")}</AlertTitle>
          <AlertDescription>
            {t("paymentFailedBody")}
          </AlertDescription>
        </Alert>
      )}

      {/* Cancelled banner */}
      {subscription?.cancel_at_period_end && (
        <Alert>
          <InfoIcon className="size-4" />
          <AlertTitle>{t("cancelScheduledTitle")}</AlertTitle>
          <AlertDescription>
            {t("cancelScheduledBody", {
              date: formatDateLong(subscription.current_period_end),
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* CURRENT PLAN */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="inline-flex items-center gap-1.5">
                {t("currentPlan")}
                <InfoTip term="moovliProSubscription" />
              </CardTitle>
              <CardDescription>
                {activePlan
                  ? `${activePlan.name} — ${formatMoneyWhole(activePlan.price_mad, currency)} / ${activePlan.billing_interval}`
                  : t("noActivePlan")}
              </CardDescription>
            </div>
            {subscription && (
              <Badge variant={STATUS_BADGE[subscription.status].variant}>
                {t(STATUS_BADGE[subscription.status].labelKey)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {subscription.current_period_end && (
                <div>
                  <dt className="text-muted-foreground">{t("nextBill")}</dt>
                  <dd>{formatDateLong(subscription.current_period_end)}</dd>
                </div>
              )}
              {subscription.trial_end && isTrialing && (
                <div>
                  <dt className="text-muted-foreground">{t("trialEnds")}</dt>
                  <dd>{formatDateLong(subscription.trial_end)}</dd>
                </div>
              )}
              {subscription.payment_attempt_count != null && subscription.payment_attempt_count > 0 && (
                <div>
                  <dt className="text-muted-foreground">{t("paymentAttempts")}</dt>
                  <dd>{subscription.payment_attempt_count}/3</dd>
                </div>
              )}
            </dl>
          )}

          {canManage && subscription?.stripe_subscription_id && (
            <Button onClick={launchPortal} disabled={actionLoading === "portal"} variant="outline">
              <CreditCardIcon className="size-4 mr-2" />
              {actionLoading === "portal" ? t("opening") : t("managePayment")}
              <ExternalLinkIcon className="size-3 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* PLAN CATALOG / UPGRADE */}
      {(noCardOnTrial || !subscription || subscription.status === "cancelled" || activePlan?.slug === "standard") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("plans")}</CardTitle>
            <CardDescription>
              {noCardOnTrial ? t("plansDescNoCard") : t("plansDesc")}
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
                          <CheckIcon className="size-3 mr-1" /> {t("current")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold mb-1">
                      {formatMoneyWhole(plan.price_mad, currency)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        {t("perMonth")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                    <ul className="space-y-1 text-xs mb-4">
                      {plan.allowed_channel_types.includes("marketplace") && (
                        <li className="flex items-start gap-1">
                          <CheckIcon className="size-3 mt-0.5 text-emerald-600" />
                          {t("featureMarketplace")}
                        </li>
                      )}
                      <li className="flex items-start gap-1">
                        <CheckIcon className="size-3 mt-0.5 text-emerald-600" />
                        {t("featureBookingPage")}
                      </li>
                      <li className="flex items-start gap-1">
                        <CheckIcon className="size-3 mt-0.5 text-emerald-600" />
                        {t("featureCalendarLinks")}
                      </li>
                      <li className="flex items-start gap-1">
                        <CheckIcon className="size-3 mt-0.5 text-emerald-600" />
                        {t("featureWidget")}
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
                          ? tc("loading")
                          : isUpgrade
                            ? t("upgrade")
                            : t("choosePlan")}
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
            <CardTitle>{t("billingHistory")}</CardTitle>
            <CardDescription>{t("invoiceCount", { count: invoices.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">{t("colDate")}</th>
                  <th className="text-left py-2">{t("colAmount")}</th>
                  <th className="text-left py-2">{tc("status")}</th>
                  <th className="text-right py-2">{t("colInvoice")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-b-0">
                    <td className="py-2">{formatDateLong(inv.paid_at ?? inv.created_at)}</td>
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
    </BaseLayout>
  );
}
