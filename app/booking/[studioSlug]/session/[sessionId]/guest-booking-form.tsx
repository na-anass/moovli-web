"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoneyWhole } from "@/lib/money";
import { CheckCircleIcon } from "lucide-react";
import { useState } from "react";

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

export function GuestBookingForm({
  sessionId,
  entityId,
  serviceId,
  channelId,
  priceMad,
  currency,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ bookingId: string } | null>(null);

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
        setError(json.message || "Booking failed. Please try again.");
        setSubmitting(false);
        return;
      }
      setConfirmation({ bookingId: json.data.bookingId });
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-3">
        <CheckCircleIcon className="size-12 text-emerald-600 mx-auto" />
        <h2 className="text-lg font-semibold">Reservation received</h2>
        <p className="text-sm text-muted-foreground">
          The studio will confirm your booking by email shortly.
          You'll pay <strong className="text-foreground">{formatMoneyWhole(priceMad, currency)}</strong> at the studio.
        </p>
        <p className="text-xs text-muted-foreground">
          Reference: <code className="font-mono">{confirmation.bookingId.slice(0, 8)}</code>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Reserve your spot</h2>
        <p className="text-xs text-muted-foreground mt-1">
          The studio will confirm your reservation by email. Pay {formatMoneyWhole(priceMad, currency)} at the studio.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Your name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            className="mt-1"
            placeholder="Karima Tazi"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Email *</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Phone <span className="text-[10px]">(optional)</span>
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1"
            placeholder="+212 6 12 34 56 78"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Notes <span className="text-[10px]">(optional)</span>
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1"
            placeholder="First time, beginner level…"
          />
        </div>
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" disabled={submitting || !name || !email} className="w-full">
        {submitting ? "Reserving…" : `Reserve · ${formatMoneyWhole(priceMad, currency)} at studio`}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center">
        By reserving, you agree to Moovli's terms.
      </p>
    </form>
  );
}
