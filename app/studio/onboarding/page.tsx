"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { catalogApi, type Category } from "@/lib/api/catalog";
import { entityPlansApi, type EntityPlan } from "@/lib/api/entityPlans";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarPlusIcon,
  CheckCircle2Icon,
  CheckIcon,
  CoinsIcon,
  GlobeIcon,
  LandmarkIcon,
  PackagePlusIcon,
  PaletteIcon,
  PartyPopperIcon,
  ShoppingBagIcon,
  SparklesIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoneyWhole } from "@/lib/money";

// ============================================================================
// Step config
// ============================================================================

type StepKey = "welcome" | "brand" | "service" | "plan" | "session" | "payouts" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "welcome", label: "Welcome" },
  { key: "brand", label: "Brand" },
  { key: "service", label: "First service" },
  { key: "plan", label: "Plan" },
  { key: "session", label: "First session" },
  { key: "payouts", label: "Payouts" },
];

const BRAND_PRESETS = [
  { label: "Moovli orange", value: "#f26c2c" },
  { label: "Magenta", value: "#d946ef" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Slate", value: "#64748b" },
];

const DEFAULT_COLOR = "#f26c2c";

// ============================================================================
// Page
// ============================================================================

export default function StudioOnboardingPage() {
  const { roles, loading: authLoading } = useAuth();
  const router = useRouter();
  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const entityName = roles?.ownedEntities?.[0]?.entityName;
  const onboardedAt = roles?.ownedEntities?.[0]?.onboardedAt;
  const currency = roles?.ownedEntities?.[0]?.currencyCode ?? "MAD";

  // If already onboarded, bounce to dashboard.
  useEffect(() => {
    if (!authLoading && onboardedAt) {
      router.replace("/studio/dashboard");
    }
  }, [authLoading, onboardedAt, router]);

  const [step, setStep] = useState<StepKey>("welcome");
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const totalSteps = STEPS.length;

  // Shared state
  const [completing, setCompleting] = useState(false);

  // ── Brand step ───────────────────────────────────────────────────────────
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [savingBrand, setSavingBrand] = useState(false);

  // ── Service step ─────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    category_id: "",
    duration_minutes: 60,
    capacity: 10,
    base_price: 100,
    short_description: "",
  });
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);

  // ── Plan step ────────────────────────────────────────────────────────────
  const [plans, setPlans] = useState<EntityPlan[]>([]);
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState<"standard" | "marketplace" | null>(null);

  // ── Session step ─────────────────────────────────────────────────────────
  const [sessionForm, setSessionForm] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return {
      date: d.toISOString().slice(0, 10),
      time: "18:00",
      capacity: 10,
      price_mad: 100,
      publish_marketplace: true,
      publish_direct: true,
    };
  });
  const [savingSession, setSavingSession] = useState(false);
  const [sessionCreated, setSessionCreated] = useState(false);

  // ── Payouts step ─────────────────────────────────────────────────────────
  const [payoutForm, setPayoutForm] = useState({
    account_holder: "",
    iban: "",
    bank_name: "",
    swift_bic: "",
  });
  const [savingPayout, setSavingPayout] = useState(false);

  // ── Load reference data ──────────────────────────────────────────────────
  const fetchInit = useCallback(async () => {
    if (!entityId) return;
    try {
      const [catRes, plansRes, subRes, brandRes] = await Promise.all([
        catalogApi.listCategories({ limit: 50 }),
        entityPlansApi.listPlans(),
        entityPlansApi.getSubscription(entityId),
        studioApi.getBranding(entityId),
      ]);
      setCategories(catRes.data);
      setPlans(plansRes.data);
      setCurrentPlanSlug(subRes.data.plan?.slug ?? null);
      if (brandRes.data.primary_color) setColor(brandRes.data.primary_color);
    } catch (e) {
      console.error(e);
    }
  }, [entityId]);

  useEffect(() => {
    fetchInit();
  }, [fetchInit]);

  // ── Step navigation ──────────────────────────────────────────────────────
  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.key);
    else setStep("done");
  };
  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.key);
  };

  const handleComplete = async () => {
    if (!entityId) return;
    setCompleting(true);
    try {
      await studioApi.completeOnboarding(entityId);
      router.replace("/studio/dashboard");
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
      setCompleting(false);
    }
  };

  // ── Step actions ─────────────────────────────────────────────────────────
  const saveBrand = async () => {
    if (!entityId) return goNext();
    setSavingBrand(true);
    try {
      await studioApi.updateBranding(entityId, color);
      goNext();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingBrand(false);
    }
  };

  const saveService = async () => {
    if (!entityId) return goNext();
    if (!serviceForm.name.trim()) {
      alert("Please give your service a name.");
      return;
    }
    setSavingService(true);
    try {
      const res = await studioApi.createService(entityId, {
        name: serviceForm.name.trim(),
        category_id: serviceForm.category_id || null,
        duration_minutes: Number(serviceForm.duration_minutes),
        capacity: Number(serviceForm.capacity),
        base_price: Number(serviceForm.base_price),
        short_description: serviceForm.short_description || null,
      });
      setServiceId(res.data.id);
      goNext();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingService(false);
    }
  };

  const choosePlan = async (slug: "standard" | "marketplace") => {
    if (!entityId) return;
    setPlanSaving(slug);
    try {
      const successUrl = `${window.location.origin}/studio/onboarding?step=session`;
      const cancelUrl = `${window.location.origin}/studio/onboarding?step=plan`;
      const res = await entityPlansApi.createCheckoutSession({
        entityId,
        planSlug: slug,
        successUrl,
        cancelUrl,
      });
      window.location.href = res.data.url;
    } catch (e) {
      alert((e as Error).message);
      setPlanSaving(null);
    }
  };

  const saveSession = async () => {
    if (!entityId) return goNext();
    if (!serviceId) {
      // No service from this wizard — skip session step too.
      goNext();
      return;
    }
    setSavingSession(true);
    try {
      const start = new Date(`${sessionForm.date}T${sessionForm.time}:00`);
      const end = new Date(start.getTime() + serviceForm.duration_minutes * 60_000);
      const publish: string[] = [];
      if (sessionForm.publish_marketplace) publish.push("marketplace");
      if (sessionForm.publish_direct) publish.push("direct_hosted");
      await studioApi.createSession(entityId, {
        service_id: serviceId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        capacity: Number(sessionForm.capacity),
        price_mad: Number(sessionForm.price_mad),
        publish_to_channel_types: publish.length > 0 ? publish : undefined,
      });
      setSessionCreated(true);
      goNext();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingSession(false);
    }
  };

  const savePayout = async () => {
    if (!entityId) return goNext();
    if (!payoutForm.account_holder.trim()) {
      alert("Account holder is required.");
      return;
    }
    setSavingPayout(true);
    try {
      await studioApi.updatePayoutMethod(entityId, {
        account_holder: payoutForm.account_holder.trim(),
        iban: payoutForm.iban.trim() || undefined,
        bank_name: payoutForm.bank_name.trim() || undefined,
        swift_bic: payoutForm.swift_bic.trim() || undefined,
      });
      goNext();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingPayout(false);
    }
  };

  // ── Skip-to-end shortcut ─────────────────────────────────────────────────
  const skipToEnd = () => setStep("done");

  // ── Loading guards ───────────────────────────────────────────────────────
  if (authLoading || !entityId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/img/moovli-icon.png"
              alt="Moovli"
              width={28}
              height={28}
              className="rounded-md shrink-0"
            />
            <span className="text-sm font-semibold truncate">
              {entityName ?? "Studio setup"}
            </span>
          </div>
          {step !== "done" && (
            <button
              onClick={skipToEnd}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip onboarding
            </button>
          )}
        </div>

        {/* Progress bar */}
        {step !== "done" && (
          <div className="mx-auto max-w-5xl px-6 pb-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              <span>
                Step {stepIndex + 1} of {totalSteps} · {STEPS[stepIndex].label}
              </span>
              <span>{Math.round(((stepIndex + 1) / totalSteps) * 100)}%</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Body */}
      <main className="mx-auto max-w-2xl px-6 py-10">
        {step === "welcome" && (
          <WelcomeStep
            entityName={entityName ?? "your studio"}
            onContinue={goNext}
            onSkip={skipToEnd}
          />
        )}

        {step === "brand" && (
          <BrandStep
            color={color}
            setColor={setColor}
            currency={currency}
            saving={savingBrand}
            onContinue={saveBrand}
            onBack={goBack}
            onSkip={goNext}
          />
        )}

        {step === "service" && (
          <ServiceStep
            form={serviceForm}
            setForm={setServiceForm}
            categories={categories}
            currency={currency}
            saving={savingService}
            onContinue={saveService}
            onBack={goBack}
            onSkip={goNext}
          />
        )}

        {step === "plan" && (
          <PlanStep
            plans={plans}
            currentPlanSlug={currentPlanSlug}
            currency={currency}
            saving={planSaving}
            onChoose={choosePlan}
            onBack={goBack}
            onSkip={goNext}
          />
        )}

        {step === "session" && (
          <SessionStep
            form={sessionForm}
            setForm={setSessionForm}
            color={color}
            currency={currency}
            hasService={!!serviceId}
            saving={savingSession}
            onContinue={saveSession}
            onBack={goBack}
            onSkip={goNext}
          />
        )}

        {step === "payouts" && (
          <PayoutsStep
            form={payoutForm}
            setForm={setPayoutForm}
            saving={savingPayout}
            onContinue={savePayout}
            onBack={goBack}
            onSkip={goNext}
          />
        )}

        {step === "done" && (
          <DoneStep
            entityName={entityName ?? "Your studio"}
            color={color}
            serviceName={serviceForm.name}
            sessionCreated={sessionCreated}
            planSlug={currentPlanSlug}
            completing={completing}
            onFinish={handleComplete}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Step components
// ============================================================================

function StepShell({
  icon: Icon,
  title,
  subtitle,
  children,
  primary,
  secondary,
  back,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  primary: { label: string; onClick: () => void; loading?: boolean; disabled?: boolean };
  secondary?: { label: string; onClick: () => void };
  back?: { onClick: () => void };
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="space-y-5">{children}</div>

      <div className="mt-7 pt-5 border-t flex items-center justify-between gap-3">
        <div>
          {back && (
            <Button variant="ghost" size="sm" onClick={back.onClick}>
              <ArrowLeftIcon className="size-3.5 mr-1.5" /> Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {secondary && (
            <Button variant="ghost" size="sm" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          )}
          <Button onClick={primary.onClick} disabled={primary.disabled || primary.loading}>
            {primary.loading ? "Saving…" : primary.label}
            {!primary.loading && <ArrowRightIcon className="size-3.5 ml-1.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Welcome ────────────────────────────────────────────────────────────────
function WelcomeStep({
  entityName,
  onContinue,
  onSkip,
}: {
  entityName: string;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-10 shadow-sm text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
        <SparklesIcon className="size-7" />
      </div>
      <h1 className="text-2xl font-semibold">Welcome, {entityName}</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Let&apos;s get your studio ready to take bookings. This takes about 5 minutes —
        you can skip any step and come back later.
      </p>

      <ul className="my-7 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto">
        {[
          { icon: PaletteIcon, label: "Set your brand color" },
          { icon: PackagePlusIcon, label: "Add your first service" },
          { icon: CoinsIcon, label: "Choose your plan" },
          { icon: CalendarPlusIcon, label: "Schedule a session" },
        ].map((it, i) => (
          <li
            key={i}
            className="flex items-center gap-2.5 rounded-lg border bg-background/60 px-3 py-2.5"
          >
            <it.icon className="size-4 text-primary" />
            <span className="text-xs">{it.label}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          I&apos;ll set up later
        </Button>
        <Button onClick={onContinue} size="lg">
          Get started
          <ArrowRightIcon className="size-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ── Brand ──────────────────────────────────────────────────────────────────
function BrandStep({
  color,
  setColor,
  currency,
  saving,
  onContinue,
  onBack,
  onSkip,
}: {
  color: string;
  setColor: (c: string) => void;
  currency: string;
  saving: boolean;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      icon={PaletteIcon}
      title="Pick your brand color"
      subtitle="Used on your public booking page — Book buttons, accents, and price highlights."
      primary={{ label: "Continue", onClick: onContinue, loading: saving }}
      secondary={{ label: "Skip for now", onClick: onSkip }}
      back={{ onClick: onBack }}
    >
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="size-12 rounded border cursor-pointer"
        />
        <Input
          value={color}
          onChange={(e) => setColor(e.target.value.toLowerCase())}
          className="w-32 h-12 font-mono text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {BRAND_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setColor(p.value)}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs hover:bg-accent",
              color === p.value && "border-primary bg-primary/5",
            )}
          >
            <span
              className="size-3 rounded-full ring-1 ring-border"
              style={{ backgroundColor: p.value }}
            />
            {p.label}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div
        className="rounded-lg border p-4 mt-2"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div>
            <div className="font-semibold">18:00 · Yoga Flow</div>
            <div className="text-xs text-muted-foreground">60 min · with Sara</div>
          </div>
          <div className="text-right">
            <div className="font-semibold" style={{ color }}>
              {formatMoneyWhole(100, currency)}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          Book
        </button>
      </div>
    </StepShell>
  );
}

// ── Service ────────────────────────────────────────────────────────────────
function ServiceStep({
  form,
  setForm,
  categories,
  currency,
  saving,
  onContinue,
  onBack,
  onSkip,
}: {
  form: {
    name: string;
    category_id: string;
    duration_minutes: number;
    capacity: number;
    base_price: number;
    short_description: string;
  };
  setForm: (next: typeof form) => void;
  categories: Category[];
  currency: string;
  saving: boolean;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      icon={PackagePlusIcon}
      title="Add your first service"
      subtitle="This is what people book — a class, a session, a treatment."
      primary={{ label: "Create & continue", onClick: onContinue, loading: saving }}
      secondary={{ label: "Skip for now", onClick: onSkip }}
      back={{ onClick: onBack }}
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">Service name</label>
        <Input
          className="mt-1.5"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Vinyasa Flow"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Category</label>
        <Select
          value={form.category_id}
          onValueChange={(v) => setForm({ ...form, category_id: v })}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Pick a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Duration (min)</label>
          <Input
            className="mt-1.5"
            type="number"
            min={1}
            value={form.duration_minutes}
            onChange={(e) =>
              setForm({ ...form, duration_minutes: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Capacity</label>
          <Input
            className="mt-1.5"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Price ({currency})</label>
          <Input
            className="mt-1.5"
            type="number"
            min={0}
            value={form.base_price}
            onChange={(e) => setForm({ ...form, base_price: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Short description <span className="text-muted-foreground/60">(optional)</span>
        </label>
        <Textarea
          className="mt-1.5"
          rows={2}
          value={form.short_description}
          onChange={(e) => setForm({ ...form, short_description: e.target.value })}
          placeholder="What makes this class special?"
        />
      </div>
    </StepShell>
  );
}

// ── Plan ───────────────────────────────────────────────────────────────────
function PlanStep({
  plans,
  currentPlanSlug,
  currency,
  saving,
  onChoose,
  onBack,
  onSkip,
}: {
  plans: EntityPlan[];
  currentPlanSlug: string | null;
  currency: string;
  saving: "standard" | "marketplace" | null;
  onChoose: (slug: "standard" | "marketplace") => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const standard = plans.find((p) => p.slug === "standard");
  const marketplace = plans.find((p) => p.slug === "marketplace");
  const hasPlan = !!currentPlanSlug;

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <div className="flex items-start gap-3 mb-6">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CoinsIcon className="size-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Choose your plan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Start with a 14-day trial — no card required during the trial.
          </p>
        </div>
      </div>

      {hasPlan && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2Icon className="size-3.5" />
          You&apos;re currently on the <strong>{currentPlanSlug}</strong> plan. You can change
          it anytime from Billing.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {standard && (
          <PlanCard
            plan={standard}
            currency={currency}
            isCurrent={currentPlanSlug === "standard"}
            isSaving={saving === "standard"}
            highlight={false}
            onChoose={() => onChoose("standard")}
            features={[
              "Public booking page",
              "Custom branding",
              "Reservation-based bookings",
              "Studio CRM",
            ]}
            note="Reservations only — bookings paid at your studio."
          />
        )}
        {marketplace && (
          <PlanCard
            plan={marketplace}
            currency={currency}
            isCurrent={currentPlanSlug === "marketplace"}
            isSaving={saving === "marketplace"}
            highlight
            onChoose={() => onChoose("marketplace")}
            features={[
              "Everything in Standard",
              "Listed in the Moovli mobile app",
              "Paid bookings via Moovli (you get payouts)",
              "Customer discovery + acquisition",
            ]}
            note="Moovli adds a small platform margin only on marketplace bookings."
          />
        )}
      </div>

      <div className="mt-7 pt-5 border-t flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon className="size-3.5 mr-1.5" /> Back
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          {hasPlan ? "Continue" : "Decide later"}
          <ArrowRightIcon className="size-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  currency,
  isCurrent,
  isSaving,
  highlight,
  features,
  note,
  onChoose,
}: {
  plan: EntityPlan;
  currency: string;
  isCurrent: boolean;
  isSaving: boolean;
  highlight: boolean;
  features: string[];
  note: string;
  onChoose: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition relative",
        highlight && "border-primary/40 bg-primary/5",
        isCurrent && "ring-2 ring-emerald-500/40",
      )}
    >
      {highlight && (
        <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[10px]">
          Most popular
        </Badge>
      )}
      <h3 className="font-semibold">{plan.name}</h3>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold">{formatMoneyWhole(plan.price_mad, currency)}</span>
        <span className="text-xs text-muted-foreground">/month</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">14-day free trial</p>

      <ul className="mt-4 space-y-1.5 text-xs">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <CheckIcon className="size-3.5 mt-0.5 text-emerald-600 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-muted-foreground mt-3 italic">{note}</p>

      <Button
        className="w-full mt-4"
        variant={highlight ? "default" : "outline"}
        disabled={isSaving || isCurrent}
        onClick={onChoose}
      >
        {isCurrent
          ? "Current plan"
          : isSaving
            ? "Redirecting…"
            : `Start ${plan.name} trial`}
      </Button>
    </div>
  );
}

// ── Session ────────────────────────────────────────────────────────────────
function SessionStep({
  form,
  setForm,
  color,
  currency,
  hasService,
  saving,
  onContinue,
  onBack,
  onSkip,
}: {
  form: {
    date: string;
    time: string;
    capacity: number;
    price_mad: number;
    publish_marketplace: boolean;
    publish_direct: boolean;
  };
  setForm: (next: typeof form) => void;
  color: string;
  currency: string;
  hasService: boolean;
  saving: boolean;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  if (!hasService) {
    return (
      <StepShell
        icon={CalendarPlusIcon}
        title="Schedule a session"
        subtitle="Looks like you skipped creating a service — you'll need one before you can schedule sessions."
        primary={{ label: "Continue", onClick: onSkip }}
        back={{ onClick: onBack }}
      >
        <p className="text-sm text-muted-foreground">
          Skip this step for now. You can add services and sessions from the studio
          dashboard anytime.
        </p>
      </StepShell>
    );
  }

  return (
    <StepShell
      icon={CalendarPlusIcon}
      title="Schedule your first session"
      subtitle="Pick a date and time. You can always add more sessions (and recurring schedules) later."
      primary={{ label: "Create & continue", onClick: onContinue, loading: saving }}
      secondary={{ label: "Skip for now", onClick: onSkip }}
      back={{ onClick: onBack }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <Input
            className="mt-1.5"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Start time</label>
          <Input
            className="mt-1.5"
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Capacity</label>
          <Input
            className="mt-1.5"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Price ({currency})</label>
          <Input
            className="mt-1.5"
            type="number"
            min={0}
            value={form.price_mad}
            onChange={(e) => setForm({ ...form, price_mad: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
        <div className="text-xs font-medium">Publish to channels</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <ShoppingBagIcon className="size-3.5 text-violet-600" />
            Marketplace
          </div>
          <Switch
            checked={form.publish_marketplace}
            onCheckedChange={(v) => setForm({ ...form, publish_marketplace: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <GlobeIcon className="size-3.5 text-emerald-600" />
            Direct booking page
          </div>
          <Switch
            checked={form.publish_direct}
            onCheckedChange={(v) => setForm({ ...form, publish_direct: v })}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Channels you haven&apos;t enabled (or aren&apos;t in your plan) will be skipped
          automatically.
        </p>
      </div>

      {/* Subtle brand-colored preview */}
      <div className="rounded-lg border p-3" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
        <div className="text-xs text-muted-foreground">Preview</div>
        <div className="mt-1 text-sm font-semibold">
          {form.date} · {form.time} — {formatMoneyWhole(form.price_mad, currency)} · {form.capacity} spots
        </div>
      </div>
    </StepShell>
  );
}

// ── Payouts ────────────────────────────────────────────────────────────────
function PayoutsStep({
  form,
  setForm,
  saving,
  onContinue,
  onBack,
  onSkip,
}: {
  form: { account_holder: string; iban: string; bank_name: string; swift_bic: string };
  setForm: (next: typeof form) => void;
  saving: boolean;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      icon={LandmarkIcon}
      title="Where should we send your payouts?"
      subtitle="Optional — only needed if you accept marketplace bookings. You can add this anytime from Settings."
      primary={{ label: "Save & finish", onClick: onContinue, loading: saving }}
      secondary={{ label: "Skip — I'll add later", onClick: onSkip }}
      back={{ onClick: onBack }}
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">Account holder</label>
        <Input
          className="mt-1.5"
          value={form.account_holder}
          onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
          placeholder="Full name as it appears on the bank account"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">IBAN</label>
        <Input
          className="mt-1.5 font-mono"
          value={form.iban}
          onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })}
          placeholder="MA64 0000 0000 0000 0000 0000"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Bank name</label>
          <Input
            className="mt-1.5"
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            placeholder="e.g. Attijariwafa Bank"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            SWIFT / BIC <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <Input
            className="mt-1.5 font-mono"
            value={form.swift_bic}
            onChange={(e) => setForm({ ...form, swift_bic: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Payouts are processed after each completed marketplace booking. Your details are
        stored encrypted and only visible to studio owners.
      </p>
    </StepShell>
  );
}

// ── Done ───────────────────────────────────────────────────────────────────
function DoneStep({
  entityName,
  color,
  serviceName,
  sessionCreated,
  planSlug,
  completing,
  onFinish,
}: {
  entityName: string;
  color: string;
  serviceName: string;
  sessionCreated: boolean;
  planSlug: string | null;
  completing: boolean;
  onFinish: () => void;
}) {
  const items = useMemo(
    () =>
      [
        color !== DEFAULT_COLOR && { label: "Brand color set", icon: PaletteIcon },
        serviceName && { label: `Created service "${serviceName}"`, icon: PackagePlusIcon },
        planSlug && { label: `Subscribed to ${planSlug} plan`, icon: CoinsIcon },
        sessionCreated && { label: "First session scheduled", icon: CalendarPlusIcon },
      ].filter(Boolean) as { label: string; icon: React.ElementType }[],
    [color, serviceName, sessionCreated, planSlug],
  );

  return (
    <div className="rounded-xl border border-border bg-card p-10 shadow-sm text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-4">
        <PartyPopperIcon className="size-7" />
      </div>
      <h1 className="text-2xl font-semibold">You&apos;re all set, {entityName}</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        Your studio is ready. From the dashboard you can add more services, schedule
        sessions, manage your channels, and track bookings.
      </p>

      {items.length > 0 && (
        <ul className="my-7 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-md mx-auto">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex items-center gap-2.5 rounded-lg border bg-emerald-50/50 border-emerald-200 px-3 py-2.5"
            >
              <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0" />
              <span className="text-xs">{it.label}</span>
            </li>
          ))}
        </ul>
      )}

      <Button size="lg" onClick={onFinish} disabled={completing}>
        {completing ? "Finishing…" : "Go to dashboard"}
        <ArrowRightIcon className="size-4 ml-2" />
      </Button>
    </div>
  );
}
