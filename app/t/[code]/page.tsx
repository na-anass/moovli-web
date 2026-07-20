import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "lucide-react";
import { formatMoneyWhole, type CurrencyCode, DEFAULT_CURRENCY } from "@/lib/money";
import { formatDateFull, formatTimeRange } from "@/lib/datetime";
import { TicketActions } from "./ticket-actions";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const BOOKING_BASE = process.env.NEXT_PUBLIC_BOOKING_BASE_URL || "http://localhost:3001";

interface Ticket {
  reference: string;
  status: string;
  guestName: string | null;
  price: number | null;
  bookingDate: string | null;
  service: { name: string } | null;
  session: { start_time: string; end_time: string; provider: { name: string } | null } | null;
  entity: { name: string; slug: string; currency_code: string | null } | null;
}

async function getTicket(code: string): Promise<Ticket | null> {
  const res = await fetch(`${API_BASE}/api/bookings/ticket/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

const STATUS_STYLE: Record<string, { tone: string; Icon: typeof CheckCircleIcon }> = {
  pending: { tone: "text-amber-600 bg-amber-500/10 border-amber-500/30", Icon: ClockIcon },
  confirmed: { tone: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", Icon: CheckCircleIcon },
  checked_in: { tone: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", Icon: CheckCircleIcon },
  completed: { tone: "text-muted-foreground bg-muted border-border", Icon: CheckCircleIcon },
  cancelled: { tone: "text-destructive bg-destructive/10 border-destructive/30", Icon: XCircleIcon },
  no_show: { tone: "text-destructive bg-destructive/10 border-destructive/30", Icon: XCircleIcon },
};

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const t = await getTranslations("ticket");
  const ticket = await getTicket(code);
  if (!ticket) notFound();

  const currency = (ticket.entity?.currency_code as CurrencyCode) || DEFAULT_CURRENCY;
  const status = STATUS_STYLE[ticket.status] ?? STATUS_STYLE.pending;
  const StatusIcon = status.Icon;
  const isActive = !["cancelled", "no_show", "completed"].includes(ticket.status);
  const sessionInFuture = ticket.session?.start_time
    ? new Date(ticket.session.start_time).getTime() > Date.now()
    : false;
  const canCancel = ["pending", "confirmed"].includes(ticket.status) && sessionInFuture;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-10 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {ticket.entity?.name}
          </p>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-5">
          <div
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${status.tone}`}
          >
            <StatusIcon className="size-4" />
            {t.has(`status.${ticket.status}`) ? t(`status.${ticket.status}`) : ticket.status}
          </div>

          {isActive && (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={`${BOOKING_BASE}/t/${ticket.reference}`} size={172} level="M" />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">{t("qrHint")}</p>
            </div>
          )}

          <dl className="space-y-2 text-sm">
            {ticket.service?.name && (
              <Row label={t("service")} value={ticket.service.name} />
            )}
            {ticket.session && (
              <>
                <Row label={t("date")} value={formatDateFull(ticket.session.start_time)} />
                <Row
                  label={t("time")}
                  value={formatTimeRange(ticket.session.start_time, ticket.session.end_time)}
                />
              </>
            )}
            {ticket.session?.provider?.name && (
              <Row label={t("instructor")} value={ticket.session.provider.name} />
            )}
            {ticket.guestName && <Row label={t("name")} value={ticket.guestName} />}
            {ticket.price != null && (
              <Row label={t("price")} value={`${formatMoneyWhole(ticket.price, currency)} · ${t("payAtStudio")}`} />
            )}
            <Row label={t("reference")} value={ticket.reference} mono />
          </dl>

          {canCancel && (
            <TicketActions
              code={ticket.reference}
              apiBase={API_BASE}
              labels={{
                cancelAction: t("cancel.action"),
                confirmQuestion: t("cancel.confirmQuestion"),
                confirmYes: t("cancel.confirmYes"),
                keep: t("cancel.keep"),
                cancelling: t("cancel.cancelling"),
                error: t("cancel.error"),
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
