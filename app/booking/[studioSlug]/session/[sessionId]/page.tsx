import { createClient } from "@/lib/supabase/server";
import { ArrowLeftIcon, CalendarIcon, ClockIcon, MapPinIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuestBookingForm } from "./guest-booking-form";

interface PageProps {
  params: Promise<{ studioSlug: string; sessionId: string }>;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default async function SessionDetailPage({ params }: PageProps) {
  const { studioSlug, sessionId } = await params;
  const supabase = await createClient();

  // Resolve channel
  const { data: channel } = await supabase
    .from("channels")
    .select("id, entity_id")
    .eq("type", "direct_hosted")
    .eq("slug", studioSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!channel) notFound();

  // Verify session is published on this channel
  const { data: pub } = await supabase
    .from("session_channels")
    .select("session_id")
    .eq("channel_id", channel.id)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!pub) notFound();

  const { data: session } = await supabase
    .from("sessions")
    .select(
      `
      id, entity_id, service_id, provider_id, start_time, end_time,
      capacity, booked_count, status, price_mad,
      service:services(name, slug, duration_minutes, description),
      provider:service_providers(name, avatar_url, title)
      `,
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) notFound();

  const { data: entity } = await supabase
    .from("entities")
    .select("name, address_line1, city, settings")
    .eq("id", session.entity_id)
    .maybeSingle();

  const brandColor =
    (entity?.settings as { brand?: { primary_color?: string } } | null)?.brand?.primary_color ?? null;

  const spotsLeft = session.capacity - session.booked_count;
  const isFull = spotsLeft <= 0;
  const sessionStart = new Date(session.start_time);
  const isPast = sessionStart <= new Date();

  // Service & provider can be returned as arrays from PostgREST joins
  const service = (Array.isArray(session.service) ? session.service[0] : session.service) as {
    name: string;
    slug: string;
    duration_minutes: number;
    description: string | null;
  } | null;
  const provider = (Array.isArray(session.provider) ? session.provider[0] : session.provider) as {
    name: string;
    avatar_url: string | null;
    title: string | null;
  } | null;

  return (
    <div className="space-y-6">
      <Link
        href={`/booking/${studioSlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3" /> Back to all sessions
      </Link>

      <div className="rounded-lg border p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{service?.name ?? "Session"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{entity?.name}</p>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Date</dt>
              <dd className="font-medium">{formatDate(session.start_time)}</dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon className="size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Time</dt>
              <dd className="font-medium">
                {formatTime(session.start_time)} – {formatTime(session.end_time)}
                {service?.duration_minutes != null && (
                  <span className="text-muted-foreground"> ({service.duration_minutes} min)</span>
                )}
              </dd>
            </div>
          </div>
          {provider?.name && (
            <div className="flex items-center gap-2 col-span-2">
              <div className="size-4" />
              <div>
                <dt className="text-xs text-muted-foreground">Instructor</dt>
                <dd className="font-medium">{provider.name}</dd>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">Spots remaining</dt>
              <dd className="font-medium">
                {spotsLeft} / {session.capacity}
              </dd>
            </div>
          </div>
          {entity?.address_line1 && (
            <div className="flex items-center gap-2">
              <MapPinIcon className="size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Location</dt>
                <dd className="font-medium">
                  {entity.address_line1}
                  {entity.city && `, ${entity.city}`}
                </dd>
              </div>
            </div>
          )}
        </dl>

        {service?.description && (
          <div className="rounded bg-muted/50 p-3 text-sm text-muted-foreground">
            {service.description}
          </div>
        )}

        <div className="border-t pt-4 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Price</span>
          <span
            className="text-2xl font-bold"
            style={brandColor ? { color: brandColor } : undefined}
          >
            {Number(session.price_mad).toFixed(0)} MAD
          </span>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Pay at the studio</p>
      </div>

      {/* Booking form */}
      {!isPast && !isFull && (
        <GuestBookingForm
          sessionId={session.id}
          entityId={session.entity_id}
          serviceId={session.service_id}
          channelId={channel.id}
          studioSlug={studioSlug}
          priceMad={Number(session.price_mad)}
        />
      )}

      {isFull && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-center">
          This session is fully booked.
        </div>
      )}
      {isPast && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-center text-muted-foreground">
          This session has already started.
        </div>
      )}
    </div>
  );
}
