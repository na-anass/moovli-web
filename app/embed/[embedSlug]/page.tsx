import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { ClockIcon, UsersIcon } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ embedSlug: string }>;
}

interface SessionRow {
  id: string;
  start_time: string;
  capacity: number;
  booked_count: number;
  status: string;
  price_mad: number;
  service: { name: string; duration_minutes: number } | null;
  provider: { name: string } | null;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const formatDateHeader = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default async function EmbedWidgetPage({ params }: PageProps) {
  const { embedSlug } = await params;
  const supabase = await createClient();

  // Resolve embed channel
  const { data: channel } = await supabase
    .from("channels")
    .select("id, entity_id, label, settings")
    .eq("type", "direct_embed")
    .eq("slug", embedSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!channel?.entity_id) notFound();

  const { data: entity } = await supabase
    .from("entities")
    .select("id, name, slug")
    .eq("id", channel.entity_id)
    .maybeSingle();

  if (!entity?.slug) notFound();

  // Fetch upcoming sessions (next 14 days)
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const { data: rows } = await supabase
    .from("session_channels")
    .select(
      `session:sessions!inner(
        id, start_time, capacity, booked_count, status, price_mad,
        service:services(name, duration_minutes),
        provider:service_providers(name)
      )`,
    )
    .eq("channel_id", channel.id)
    .gte("session.start_time", new Date().toISOString())
    .lte("session.start_time", horizon.toISOString())
    .order("session(start_time)", { ascending: true })
    .limit(50);

  const sessions: SessionRow[] = ((rows as unknown as Array<{ session: SessionRow }>) ?? [])
    .map((r) => r.session)
    .filter((s) => s && s.status === "available");

  // Group by date
  const sessionsByDate = sessions.reduce<Record<string, SessionRow[]>>((acc, s) => {
    const day = s.start_time.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});

  return (
    <div className="text-sm">
      <div className="font-semibold mb-3">{entity.name}</div>

      {Object.keys(sessionsByDate).length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No sessions in the next 14 days.
        </p>
      ) : (
        <div className="space-y-3 max-h-[560px] overflow-y-auto">
          {Object.entries(sessionsByDate).map(([day, daySessions]) => (
            <section key={day}>
              <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                {formatDateHeader(daySessions[0].start_time)}
              </h3>
              <div className="space-y-1">
                {daySessions.map((s) => {
                  const spotsLeft = s.capacity - s.booked_count;
                  const isFull = spotsLeft <= 0;
                  const bookingUrl = `/booking/${entity.slug}/session/${s.id}`;
                  return (
                    <a
                      key={s.id}
                      href={bookingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`block rounded border p-2 transition ${
                        isFull
                          ? "opacity-50 pointer-events-none"
                          : "hover:border-primary hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-xs">
                              {formatTime(s.start_time)}
                            </span>
                            <span className="text-xs truncate">
                              {s.service?.name ?? "Session"}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            {s.service?.duration_minutes != null && (
                              <span className="inline-flex items-center gap-0.5">
                                <ClockIcon className="size-2.5" />
                                {s.service.duration_minutes}m
                              </span>
                            )}
                            <span className="inline-flex items-center gap-0.5">
                              <UsersIcon className="size-2.5" />
                              {spotsLeft}/{s.capacity}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-xs whitespace-nowrap">
                          <div className="font-semibold">
                            {Number(s.price_mad).toFixed(0)} MAD
                          </div>
                          {isFull ? (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 mt-0.5">
                              Full
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-primary">Book →</span>
                          )}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
