"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { studioApi } from "@/lib/api/studio";
import { channelsApi } from "@/lib/api/channels";
import { entityPlansApi, type EntityPlan } from "@/lib/api/entityPlans";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoneyWhole } from "@/lib/money";
import {
  CheckIcon,
  CheckCircle2Icon,
  CopyIcon,
  Loader2Icon,
  MessageCircleIcon,
  InstagramIcon,
  BuildingIcon,
} from "lucide-react";
import Image from "next/image";
import { InfoTip } from "@/components/ui/info-tip";
import { useDialogs } from "@/components/shared/dialogs";
import { PanelHeading } from "./PanelHeading";
import { slugify, type OnboardingData } from "../_lib/useOnboarding";

type SlugState = "idle" | "checking" | "available" | "taken" | "invalid";

export function PublishStage({ data }: { data: OnboardingData }) {
  const { entityId, profile, color, channel, setChannelSlug, services, currency, plans, currentPlanSlug, refreshSubscription, flashSaved } = data;
  const { notify } = useDialogs();
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");

  const origin = typeof window !== "undefined" ? window.location.origin : "https://moovli.app";
  const suggested = channel?.slug || slugify(profile.name) || "my-studio";

  const [handle, setHandle] = useState(suggested);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [savingSlug, setSavingSlug] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the field in sync if the channel slug loads/updates after mount.
  useEffect(() => {
    if (channel?.slug) setHandle(channel.slug);
  }, [channel?.slug]);

  const url = `${origin}/booking/${handle}`;

  const checkAvailability = (candidate: string) => {
    // Match the backend rule: 2–40 chars, lowercase alphanumeric + hyphens,
    // must start and end alphanumeric (no leading/trailing hyphen).
    if (!/^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(candidate)) {
      setSlugState("invalid");
      return;
    }
    if (channel && candidate === channel.slug) {
      setSlugState("available");
      return;
    }
    setSlugState("checking");
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data: rows } = await supabase
          .from("channels")
          .select("id")
          .eq("type", "direct_hosted")
          .eq("slug", candidate)
          .limit(1);
        setSlugState(rows && rows.length > 0 ? "taken" : "available");
      } catch {
        setSlugState("available"); // best-effort; save enforces uniqueness
      }
    }, 400);
  };

  const onHandleChange = (raw: string) => {
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setHandle(cleaned);
    checkAvailability(cleaned);
  };

  const saveSlug = async () => {
    if (slugState === "invalid" || slugState === "taken") return;
    if (channel && handle === channel.slug) return;
    setSavingSlug(true);
    try {
      if (channel) {
        await channelsApi.update(channel.id, { slug: handle });
      } else {
        const res = await channelsApi.create({
          entityId,
          type: "direct_hosted",
          slug: handle,
          label: profile.name || "Booking page",
        });
        // reflect the new channel slug locally
        setChannelSlug(res.data.slug);
      }
      setChannelSlug(handle);
      flashSaved();
      setSlugState("available");
    } catch (e) {
      const msg = (e as Error).message;
      // A brand-new studio with no channel yet can't create one until a plan is
      // active. Reassure rather than error — the booking page is provisioned
      // automatically when they finish setup, using this handle's default.
      if (msg.includes("PLAN_DOES_NOT_ALLOW")) {
        notify(
          t("publish.linkFinalizeNote"),
          { title: t("common.almostThere") },
        );
      } else {
        notify(msg, { variant: "error" });
      }
    } finally {
      setSavingSlug(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <PanelHeading
          title={t("publish.title")}
          subtitle={t("publish.subtitle")}
        />

        {/* Slug editor */}
        <label className="mb-1.5 block text-sm font-medium">{t("publish.bookingLink")}</label>
        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 items-center rounded-md border bg-muted/30 pl-3 focus-within:border-primary">
            <span className="shrink-0 text-sm text-muted-foreground">{origin.replace(/^https?:\/\//, "")}/booking/</span>
            <Input
              value={handle}
              onChange={(e) => onHandleChange(e.target.value)}
              onBlur={saveSlug}
              className="border-0 bg-transparent px-1 font-medium shadow-none focus-visible:ring-0"
              placeholder="my-studio"
            />
            <span className="flex shrink-0 items-center gap-1 pr-3 text-xs">
              {slugState === "checking" && <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />}
              {slugState === "available" && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckIcon className="size-3.5" /> {t("publish.slug.available")}
                </span>
              )}
              {slugState === "taken" && <span className="text-destructive">{t("publish.slug.taken")}</span>}
              {slugState === "invalid" && <span className="text-muted-foreground">{t("publish.slug.invalid")}</span>}
            </span>
          </div>
          <Button onClick={saveSlug} disabled={savingSlug || slugState === "taken" || slugState === "invalid"}>
            {savingSlug ? tc("saving") : tc("save")}
          </Button>
        </div>

        {/* Preview card */}
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
            <span className="flex gap-1">
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
            </span>
            <span className="rounded bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {url.replace(/^https?:\/\//, "")}
            </span>
          </div>
          <div className="flex items-center gap-3 p-4">
            {profile.logo_url ? (
              <Image
                src={profile.logo_url}
                alt={profile.name}
                width={48}
                height={48}
                className="size-12 rounded-lg object-cover"
              />
            ) : (
              <span
                className="flex size-12 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: color }}
              >
                <BuildingIcon className="size-6" />
              </span>
            )}
            <div className="flex-1">
              <div className="font-semibold">{profile.name || t("publish.yourStudio")}</div>
              {profile.city && (
                <div className="text-sm text-muted-foreground">{profile.city}</div>
              )}
            </div>
            {services[0] && (
              <Badge style={{ backgroundColor: `${color}20`, color }}>{services[0].name}</Badge>
            )}
          </div>
        </div>

        {/* Share */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => copy(url)}>
            <CopyIcon className="mr-1.5 size-4" /> {t("publish.copyLink")}
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(t("publish.whatsappText", { url }))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircleIcon className="mr-1.5 size-4" /> {t("publish.shareWhatsApp")}
            </a>
          </Button>
          <Button variant="outline" onClick={() => copy(url)}>
            <InstagramIcon className="mr-1.5 size-4" /> {t("publish.addToInstagram")}
          </Button>
        </div>
      </div>

      {/* Plan / payment */}
      <PlanSection
        entityId={entityId}
        plans={plans}
        currentPlanSlug={currentPlanSlug}
        currency={currency}
      />

      {/* Payout — only when on the online-payment (marketplace) plan */}
      {currentPlanSlug === "marketplace" && (
        <PayoutSection entityId={entityId} onSaved={() => { flashSaved(); refreshSubscription(); }} />
      )}
    </div>
  );
}

// ── Plan section ─────────────────────────────────────────────────────────────
function PlanSection({
  entityId,
  plans,
  currentPlanSlug,
  currency,
}: {
  entityId: string;
  plans: EntityPlan[];
  currentPlanSlug: string | null;
  currency: string;
}) {
  const { notify } = useDialogs();
  const t = useTranslations("onboarding");
  const [saving, setSaving] = useState<"standard" | "marketplace" | null>(null);
  const standard = useMemo(() => plans.find((p) => p.slug === "standard"), [plans]);
  const marketplace = useMemo(() => plans.find((p) => p.slug === "marketplace"), [plans]);

  const choose = async (slug: "standard" | "marketplace") => {
    setSaving(slug);
    try {
      const base = `${window.location.origin}/studio/onboarding?stage=publish`;
      const res = await entityPlansApi.createCheckoutSession({
        entityId,
        planSlug: slug,
        successUrl: base,
        cancelUrl: base,
      });
      window.location.href = res.data.url;
    } catch (e) {
      notify((e as Error).message, { variant: "error" });
      setSaving(null);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold">{t("publish.plans.heading")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("publish.plans.description")}
      </p>

      {currentPlanSlug && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2Icon className="size-3.5" />
          {t.rich("publish.plans.currentNotice", {
            plan: currentPlanSlug,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {standard && (
          <PlanCard
            plan={standard}
            currency={currency}
            title={t("publish.plans.standard.title")}
            note={t("publish.plans.standard.note")}
            features={[
              t("publish.plans.standard.features.bookingPage"),
              t("publish.plans.standard.features.branding"),
              t("publish.plans.standard.features.reservations"),
              t("publish.plans.standard.features.crm"),
            ]}
            isCurrent={currentPlanSlug === "standard"}
            isSaving={saving === "standard"}
            highlight={false}
            onChoose={() => choose("standard")}
          />
        )}
        {marketplace && (
          <PlanCard
            plan={marketplace}
            currency={currency}
            title={t("publish.plans.marketplace.title")}
            note={t("publish.plans.marketplace.note")}
            features={[
              t("publish.plans.marketplace.features.everything"),
              t("publish.plans.marketplace.features.listed"),
              t("publish.plans.marketplace.features.payments"),
              t("publish.plans.marketplace.features.discovery"),
            ]}
            isCurrent={currentPlanSlug === "marketplace"}
            isSaving={saving === "marketplace"}
            highlight
            term="marketplace"
            onChoose={() => choose("marketplace")}
          />
        )}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  currency,
  title,
  note,
  features,
  isCurrent,
  isSaving,
  highlight,
  term,
  onChoose,
}: {
  plan: EntityPlan;
  currency: string;
  title: string;
  note: string;
  features: string[];
  isCurrent: boolean;
  isSaving: boolean;
  highlight: boolean;
  term?: "marketplace";
  onChoose: () => void;
}) {
  const t = useTranslations("onboarding");
  return (
    <div
      className={cn(
        "relative rounded-xl border p-5",
        highlight && "border-primary/40 bg-primary/5",
        isCurrent && "ring-2 ring-emerald-500/40",
      )}
    >
      {highlight && (
        <Badge className="absolute -top-2.5 right-4 bg-primary text-[10px] text-primary-foreground">
          {t("publish.plans.mostPopular")}
        </Badge>
      )}
      <h4 className="flex items-center gap-1 font-semibold">
        {title}
        {term && <InfoTip term={term} />}
      </h4>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold">{formatMoneyWhole(plan.price_mad, currency)}</span>
        <span className="text-xs text-muted-foreground">{t("publish.plans.perMonth")}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{t("publish.plans.freeTrial")}</p>

      <ul className="mt-4 space-y-1.5 text-xs">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] italic text-muted-foreground">{note}</p>

      <Button
        className="mt-4 w-full"
        variant={highlight ? "default" : "outline"}
        disabled={isSaving || isCurrent}
        onClick={onChoose}
      >
        {isCurrent
          ? t("publish.plans.currentPlan")
          : isSaving
            ? t("publish.plans.redirecting")
            : t("publish.plans.startTrial", { plan: plan.name })}
      </Button>
    </div>
  );
}

// ── Payout section ───────────────────────────────────────────────────────────
function PayoutSection({
  entityId,
  onSaved,
}: {
  entityId: string;
  onSaved: () => void;
}) {
  const { notify } = useDialogs();
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const [form, setForm] = useState({ account_holder: "", iban: "", bank_name: "" });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    studioApi
      .getPayoutMethod(entityId)
      .then((res) => {
        if (res.data) {
          setForm({
            account_holder: res.data.account_holder ?? "",
            iban: res.data.iban ?? "",
            bank_name: res.data.bank_name ?? "",
          });
          setDone(true);
        }
      })
      .catch(() => {});
  }, [entityId]);

  const save = async () => {
    if (!form.account_holder.trim()) {
      notify(t("publish.payout.errors.holderRequired"), { title: t("common.almostThere") });
      return;
    }
    setSaving(true);
    try {
      await studioApi.updatePayoutMethod(entityId, {
        account_holder: form.account_holder.trim(),
        iban: form.iban.trim() || undefined,
        bank_name: form.bank_name.trim() || undefined,
      });
      setDone(true);
      onSaved();
    } catch (e) {
      notify((e as Error).message, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">{t("publish.payout.title")}</h3>
        {done && (
          <Badge className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            <CheckIcon className="size-3" /> {t("common.saved")}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("publish.payout.subtitle")}
      </p>

      <div className="mt-4 space-y-3">
        <Input
          value={form.account_holder}
          onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
          placeholder={t("publish.payout.accountHolder")}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            className="font-mono"
            value={form.iban}
            onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })}
            placeholder={t("publish.payout.iban")}
          />
          <Input
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            placeholder={t("publish.payout.bankName")}
          />
        </div>
        <Button onClick={save} disabled={saving} variant="outline">
          {saving ? tc("saving") : t("publish.payout.save")}
        </Button>
      </div>
    </div>
  );
}
