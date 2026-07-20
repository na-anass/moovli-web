"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoneyWhole } from "@/lib/money";
import { CheckCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  sessionId: string;
  entityId: string;
  serviceId: string;
  channelId: string;
  studioSlug: string;
  priceMad: number;
  currency: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const BOOKING_BASE = process.env.NEXT_PUBLIC_BOOKING_BASE_URL || "http://localhost:3001";

export function GuestBookingForm({
  sessionId,
  entityId,
  serviceId,
  channelId,
  priceMad,
  currency,
}: Props) {
  const t = useTranslations("booking");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    bookingId: string;
    qrCode: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          entityId,
          serviceId,
          channelId,
          guestEmail: email,
          guestName: name,
          guestPhone: phone || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || t("guestForm.bookingFailed"));
        setSubmitting(false);
        return;
      }
      setConfirmation({ bookingId: json.data.bookingId, qrCode: json.data.qrCode });
    } catch {
      setError(t("guestForm.networkError"));
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-3">
        <CheckCircleIcon className="size-12 text-emerald-600 mx-auto" />
        <h2 className="text-lg font-semibold">{t("guestForm.confirmationTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t.rich("guestForm.confirmationBody", {
            price: formatMoneyWhole(priceMad, currency),
            strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
          })}
        </p>
        {confirmation.qrCode && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG
                value={`${BOOKING_BASE}/t/${confirmation.qrCode}`}
                size={148}
                level="M"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("guestForm.qrHint")}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {t("guestForm.reference")}{" "}
          <code className="font-mono">{confirmation.qrCode || confirmation.bookingId.slice(0, 8)}</code>
        </p>
        {confirmation.qrCode && (
          <a
            href={`${BOOKING_BASE}/t/${confirmation.qrCode}`}
            className="inline-block text-xs font-medium text-primary underline underline-offset-2"
          >
            {t("guestForm.viewTicket")}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("guestForm.title")}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {t("guestForm.subtitle", { price: formatMoneyWhole(priceMad, currency) })}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t("guestForm.nameLabel")}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            className="mt-1"
            placeholder={t("guestForm.namePlaceholder")}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t("guestForm.emailLabel")}</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
            placeholder={t("guestForm.emailPlaceholder")}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {t("guestForm.phoneLabel")} <span className="text-[10px]">{t("guestForm.optional")}</span>
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1"
            placeholder={t("guestForm.phonePlaceholder")}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {t("guestForm.notesLabel")} <span className="text-[10px]">{t("guestForm.optional")}</span>
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1"
            placeholder={t("guestForm.notesPlaceholder")}
          />
        </div>
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={submitting || !name || !email} className="w-full">
        {submitting
          ? t("guestForm.reserving")
          : t("guestForm.reserveCta", { price: formatMoneyWhole(priceMad, currency) })}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center">
        {t("guestForm.terms")}
      </p>
    </form>
  );
}
