import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { ClockIcon, MapPinIcon, StarIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ studioSlug: string }>;
}

interface SessionRow {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string;
  price_mad: number;
  service: { name: string; slug: string; duration_minutes: number } | null;
  provider: { name: string } | null;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const formatDateHeader = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
      "id, name, short_description, address_line1, city, logo_url, cover_image_url, platform_rating, google_rating, total_reviews",
    )
    .eq("id", channel.entity_id)
    .maybeSingle();

  if (!entity) notFound();

  // Fetch sessions published on this channel for the next 14 days
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const { data: sessionRows } = await supabase
    .from("session_channels")
    .select(
      `session:sessions!inner(
        id, start_time, end_time, capacity, booked_count, status, price_mad,
        service:services(name, slug, duration_minutes),
        provider:service_providers(name)
      )`,
    )
    .eq("channel_id", channel.id)
    .gte("session.start_time", new Date().toISOString())
    .lte("session.start_time", horizon.toISOString())
    .order("session(start_time)", { ascending: true })
    .limit(200);

  const sessions: SessionRow[] = ((sessionRows as unknown as Array<{ session: SessionRow }>) ?? [])
    .map((r) => r.session)
    .filter((s) => s && s.status === "available");

  // Group by date
  const sessionsByDate = sessions.reduce<Record<string, SessionRow[]>>((acc, s) => {
    const day = s.start_time.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});

  const rating = entity.platform_rating ?? entity.google_rating ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        {entity.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entity.logo_url}
            alt={entity.name ?? ""}
            className="size-16 rounded-lg object-cover"
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

      {/* Sessions */}
      <div className="space-y-6">
        {Object.keys(sessionsByDate).length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No upcoming sessions scheduled. Check back soon!
            </p>
          </div>
        ) : (
          Object.entries(sessionsByDate).map(([day, daySessions]) => (
            <section key={day}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                {formatDateHeader(daySessions[0].start_time)}
              </h2>
              <div className="space-y-2">
                {daySessions.map((s) => {
                  const spotsLeft = s.capacity - s.booked_count;
                  const isFull = spotsLeft <= 0;
                  return (
                    <Link
                      key={s.id}
                      href={`/booking/${studioSlug}/session/${s.id}`}
                      className={`block rounded-lg border p-4 transition ${
                        isFull
                          ? "opacity-50 cursor-not-allowed pointer-events-none"
                          : "hover:border-primary hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold">{formatTime(s.start_time)}</span>
                            <span className="text-sm">{s.service?.name ?? "Session"}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                            {s.service?.duration_minutes != null && (
                              <span className="inline-flex items-center gap-1">
                                <ClockIcon className="size-3" /> {s.service.duration_minutes}min
                              </span>
                            )}
                            {s.provider?.name && <span>with {s.provider.name}</span>}
                            <span className="inline-flex items-center gap-1">
                              <UsersIcon className="size-3" /> {spotsLeft}/{s.capacity}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{Number(s.price_mad).toFixed(0)} MAD</div>
                          {isFull ? (
                            <Badge variant="outline" className="text-xs mt-1">
                              Full
                            </Badge>
                          ) : (
                            <span className="text-xs text-primary">Book →</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
