"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminApi,
  type EntityType,
  type ProvisionStudioInput,
  type ProvisionStudioResult,
} from "@/lib/api/admin";
import {
  ArrowLeftIcon,
  BuildingIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  UserIcon,
} from "lucide-react";

const CURRENCIES = ["MAD", "TND", "DZD", "EGP", "AED", "SAR", "EUR", "GBP", "USD"];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 text-xs text-muted-foreground">({optional})</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export default function ProvisionStudioPage() {
  const t = useTranslations("admin.provision");
  const tc = useTranslations("common");
  const router = useRouter();

  const [types, setTypes] = useState<EntityType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionStudioResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    ownerEmail: "",
    ownerName: "",
    ownerPhone: "",
    studioName: "",
    studioTypeSlug: "",
    slug: "",
    slugEdited: false,
    city: "",
    country: "MA",
    currencyCode: "MAD",
    contactEmail: "",
    contactPhone: "",
    credentialMode: "invite" as "invite" | "temp_password",
    planSlug: "standard" as "standard" | "marketplace",
  });

  useEffect(() => {
    adminApi
      .getEntityTypes()
      .then((res) => setTypes(res.data))
      .catch((e) => console.error(e));
  }, []);

  const slugPreview = useMemo(
    () => (form.slugEdited ? form.slug : slugify(form.studioName)),
    [form.slug, form.slugEdited, form.studioName]
  );

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canSubmit =
    !!form.ownerEmail && !!form.studioName && !!form.studioTypeSlug && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = (v: string) => (v.trim() ? v.trim() : undefined);
      const input: ProvisionStudioInput = {
        ownerEmail: form.ownerEmail.trim(),
        ownerName: trimmed(form.ownerName),
        ownerPhone: trimmed(form.ownerPhone),
        studioName: form.studioName.trim(),
        studioTypeSlug: form.studioTypeSlug as ProvisionStudioInput["studioTypeSlug"],
        slug: slugPreview ? slugPreview : undefined,
        city: trimmed(form.city),
        country: trimmed(form.country),
        currencyCode: form.currencyCode,
        contactEmail: trimmed(form.contactEmail),
        contactPhone: trimmed(form.contactPhone),
        credentialMode: form.credentialMode,
        planSlug: form.planSlug,
      };
      const res = await adminApi.provisionStudio(input);
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = async () => {
    if (!result?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  // ---- Success screen ----
  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-5" />
              {t("successTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {result.ownerAlreadyExisted
                ? t("successExistingOwner", { email: form.ownerEmail })
                : t("successNewOwner", { email: form.ownerEmail })}
            </p>

            {result.tempPassword && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-200">
                  <KeyRoundIcon className="size-4" />
                  {t("tempPasswordLabel")}
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-sm">
                    {result.tempPassword}
                  </code>
                  <Button type="button" variant="outline" size="sm" onClick={copyPassword}>
                    <CopyIcon className="size-3.5" />
                    {copied ? t("copied") : t("copy")}
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="font-medium">{form.studioName}</div>
              <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                /booking/{result.slug}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" onClick={() => router.push(`/admin/studios/${result.entityId}`)}>
                <BuildingIcon className="size-4" />
                {t("viewStudio")}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/studio/dashboard?as=${result.entityId}`)}
              >
                <ExternalLinkIcon className="size-4" />
                {t("openDashboard")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setForm((f) => ({
                    ...f,
                    ownerEmail: "",
                    ownerName: "",
                    ownerPhone: "",
                    studioName: "",
                    studioTypeSlug: "",
                    slug: "",
                    slugEdited: false,
                    city: "",
                    contactEmail: "",
                    contactPhone: "",
                  }));
                }}
              >
                {t("provisionAnother")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Form ----
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/studios")}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <div className="font-medium">{t("errorTitle")}</div>
          <div className="mt-0.5">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Owner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="size-4" />
              {t("ownerSection")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t("ownerEmail")}>
                <Input
                  type="email"
                  required
                  value={form.ownerEmail}
                  onChange={(e) => set("ownerEmail", e.target.value)}
                  placeholder="owner@studio.com"
                />
              </Field>
            </div>
            <Field label={t("ownerName")} optional={t("optional")}>
              <Input value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
            </Field>
            <Field label={t("ownerPhone")} optional={t("optional")}>
              <Input value={form.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        {/* Studio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BuildingIcon className="size-4" />
              {t("studioSection")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("studioName")}>
              <Input
                required
                value={form.studioName}
                onChange={(e) => set("studioName", e.target.value)}
              />
            </Field>
            <Field label={t("studioType")}>
              <Select
                value={form.studioTypeSlug}
                onValueChange={(v) => set("studioTypeSlug", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {types.map((ty) => (
                    <SelectItem key={ty.id} value={ty.slug}>
                      {ty.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("slug")} hint={t("slugHint")}>
                <Input
                  value={slugPreview}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: slugify(e.target.value), slugEdited: true }))
                  }
                />
              </Field>
            </div>
            <Field label={t("city")} optional={t("optional")}>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label={t("country")}>
              <Input
                value={form.country}
                maxLength={2}
                onChange={(e) => set("country", e.target.value.toUpperCase())}
              />
            </Field>
            <Field label={t("currency")}>
              <Select value={form.currencyCode} onValueChange={(v) => set("currencyCode", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("plan")}>
              <Select
                value={form.planSlug}
                onValueChange={(v) => set("planSlug", v as "standard" | "marketplace")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{t("planStandard")}</SelectItem>
                  <SelectItem value="marketplace">{t("planMarketplace")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("contactEmail")} optional={t("optional")}>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
              />
            </Field>
            <Field label={t("contactPhone")} optional={t("optional")}>
              <Input
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        {/* Owner access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRoundIcon className="size-4" />
              {t("credentialSection")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label={t("credentialMode")}>
              <Select
                value={form.credentialMode}
                onValueChange={(v) => set("credentialMode", v as "invite" | "temp_password")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invite">{t("credentialInvite")}</SelectItem>
                  <SelectItem value="temp_password">{t("credentialTemp")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">
              {form.credentialMode === "invite" ? t("credentialInviteHint") : t("credentialTempHint")}
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/admin/studios")}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
