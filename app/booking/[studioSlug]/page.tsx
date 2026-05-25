import { createClient } from "@/lib/supabase/server";
import { MapPinIcon, StarIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { BookingView, type SessionRow } from "./booking-view";

interface PageProps {
  params: Promise<{ studioSlug: string }>;
}

export default async function StudioPublicPage({ params }: PageProps) {
  const { studioSlug } = await params;
  const supabase = await createClient();

  // Resolve the studio's default direct_hosted channel by slug
  const { data: channel } = await supabase
    .from("channels")
    .select("id, entity_id, label, settings")
    .eq("type", "direct_hosted")
    .eq("slug", studioSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!channel?.entity_id) notFound();

  const { data: entity } = await supabase
    .from("entities")
    .select(
      "id, name, short_description, address_line1, city, logo_url, cover_image_url, platform_rating, google_rating, total_reviews, settings, currency_code",
    )
    .eq("id", channel.entity_id)
    .maybeSingle();

  if (!entity) notFound();

  // Studio's per-entity opt-out for direct_hosted — defaults to enabled.
  const channelPrefs =
    (entity.settings as { channels?: Record<string, boolean> } | null)?.channels ?? {};
  if (channelPrefs.direct_hosted_enabled === false) notFound();

  // Branding from entity.settings.brand.primary_color (set via studio dashboard / DB)
  const brandColor =
    (entity.settings as { brand?: { primary_color?: string } } | null)?.brand?.primary_color ?? null;

  // Fetch sessions published on this channel for the next 30 days
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const { data: sessionRows } = await supabase
    .from("session_channels")
    .select(
      `session:sessions!inner(
        id, start_time, end_time, capacity, booked_count, status, price_mad,
        service:services(id, name, slug, duration_minutes),
        provider:service_providers(id, name)
      )`,
    )
    .eq("channel_id", channel.id)
    .gte("session.start_time", new Date().toISOString())
    .lte("session.start_time", horizon.toISOString())
    .order("session(start_time)", { ascending: true })
    .limit(500);

  const sessions: SessionRow[] = ((sessionRows as unknown as Array<{ session: SessionRow }>) ?? [])
    .map((r) => r.session)
    .filter((s) => s && s.status === "available");

  const rating = entity.platform_rating ?? entity.google_rating ?? null;

  return (
    <div className="space-y-6">
      {/* Brand-tinted hero */}
      {entity.cover_image_url && (
        <div
          className="relative h-32 sm:h-48 rounded-lg overflow-hidden"
          style={{
            backgroundImage: `url(${entity.cover_image_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        {entity.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entity.logo_url}
            alt={entity.name ?? ""}
            className="size-16 rounded-lg object-cover border-2"
            style={brandColor ? { borderColor: brandColor } : undefined}
          />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{entity.name}</h1>
          {entity.short_description && (
            <p className="text-sm text-muted-foreground mt-1">{entity.short_description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {rating != null && (
              <span className="inline-flex items-center gap-1">
                <StarIcon className="size-3 text-amber-500" /> {Number(rating).toFixed(1)}
                {entity.total_reviews != null && (
                  <span className="text-xs">({entity.total_reviews})</span>
                )}
              </span>
            )}
            {entity.address_line1 && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3" /> {entity.address_line1}
                {entity.city && `, ${entity.city}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <BookingView
        sessions={sessions}
        studioSlug={studioSlug}
        entityId={channel.entity_id}
        channelId={channel.id}
        brandColor={brandColor}
        currency={(entity as { currency_code?: string }).currency_code ?? "MAD"}
      />
    </div>
  );
}
