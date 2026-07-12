"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useDialogs } from "@/components/shared/dialogs";
import { PanelHeading } from "./PanelHeading";
import { slugify, type OnboardingData } from "../_lib/useOnboarding";

type SlugState = "idle" | "checking" | "available" | "taken" | "invalid";

export function PublishStage({ data }: { data: OnboardingData }) {
  const { entityId, profile, color, channel, setChannelSlug, services, currency, plans, currentPlanSlug, refreshSubscription, flashSaved } = data;
  const { notify } = useDialogs();

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
          "Your booking link will be finalized when you finish setup — pick a plan below first to customize it now.",
          { title: "Almost there" },
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
          title="Your booking page is ready"
          subtitle="Personalize your link and share it with your clients."
        />

        {/* Slug editor */}
        <label className="mb-1.5 block text-sm font-medium">Booking link</label>
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
                  <CheckIcon className="size-3.5" /> Available
                </span>
              )}
              {slugState === "taken" && <span className="text-destructive">Taken</span>}
              {slugState === "invalid" && <span className="text-muted-foreground">Use 2–40 letters, numbers, hyphens</span>}
            </span>
          </div>
          <Button onClick={saveSlug} disabled={savingSlug || slugState === "taken" || slugState === "invalid"}>
            {savingSlug ? "Saving…" : "Save"}
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
              <div className="font-semibold">{profile.name || "Your studio"}</div>
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
            <CopyIcon className="mr-1.5 size-4" /> Copy link
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Book with us: ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircleIcon className="mr-1.5 size-4" /> Share on WhatsApp
            </a>
          </Button>
          <Button variant="outline" onClick={() => copy(url)}>
            <InstagramIcon className="mr-1.5 size-4" /> Add to Instagram bio
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
      <h3 className="text-lg font-semibold">How do your clients pay?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose how payment is collected for bookings. Start with a 14-day free trial — no card required during the trial.
      </p>

      {currentPlanSlug && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2Icon className="size-3.5" />
          You&apos;re on the <strong>{currentPlanSlug}</strong> plan. You can change it anytime from Billing.
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {standard && (
          <PlanCard
            plan={standard}
            currency={currency}
            title="Pay at the studio"
            note="Clients book online and pay on-site, in cash or by card."
            features={["Public booking page", "Custom branding", "Reservation-based bookings", "Studio CRM"]}
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
            title="Pay online via Moovli"
            note="Clients pay at booking time; you're listed in the Moovli app."
            features={["Everything in Standard", "Listed in the Moovli app", "Online payments + payouts", "Customer discovery"]}
            isCurrent={currentPlanSlug === "marketplace"}
            isSaving={saving === "marketplace"}
            highlight
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
  onChoose: () => void;
}) {
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
          Most popular
        </Badge>
      )}
      <h4 className="font-semibold">{title}</h4>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold">{formatMoneyWhole(plan.price_mad, currency)}</span>
        <span className="text-xs text-muted-foreground">/month</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">14-day free trial</p>

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
        {isCurrent ? "Current plan" : isSaving ? "Redirecting…" : `Start ${plan.name} trial`}
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
      notify("Account holder is required.", { title: "Almost there" });
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
        <h3 className="text-lg font-semibold">Where should we send your payouts?</h3>
        {done && (
          <Badge className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            <CheckIcon className="size-3" /> Saved
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Needed for online (marketplace) bookings. You can also add this later in Settings.
      </p>

      <div className="mt-4 space-y-3">
        <Input
          value={form.account_holder}
          onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
          placeholder="Account holder"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            className="font-mono"
            value={form.iban}
            onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })}
            placeholder="IBAN"
          />
          <Input
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            placeholder="Bank name"
          />
        </div>
        <Button onClick={save} disabled={saving} variant="outline">
          {saving ? "Saving…" : "Save payout details"}
        </Button>
      </div>
    </div>
  );
}
