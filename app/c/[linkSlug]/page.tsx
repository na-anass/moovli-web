import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ linkSlug: string }>;
}

/**
 * Custom-link entry point — resolves the channel by slug and redirects to the
 * studio's hosted booking page filtered by the link's filters JSON.
 *
 * For v1: just redirect to the studio's main booking page (no filter UI yet).
 * The filters would render as URL query params on the destination page in a
 * future iteration.
 */
export default async function CustomLinkPage({ params }: PageProps) {
  const { linkSlug } = await params;
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("id, entity_id, filters")
    .eq("type", "direct_link")
    .eq("slug", linkSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (!channel?.entity_id) notFound();

  // Resolve the studio's hosted slug to redirect into the same booking UX
  const { data: hosted } = await supabase
    .from("channels")
    .select("slug")
    .eq("entity_id", channel.entity_id)
    .eq("type", "direct_hosted")
    .eq("is_default", true)
    .maybeSingle();

  if (!hosted?.slug) notFound();

  // Pass filters as query params so the studio page can narrow the listing
  const filters = channel.filters as { service_ids?: string[]; instructor_ids?: string[] } | null;
  const qs = new URLSearchParams();
  if (filters?.service_ids?.length) qs.set("services", filters.service_ids.join(","));
  if (filters?.instructor_ids?.length) qs.set("instructors", filters.instructor_ids.join(","));
  qs.set("via", linkSlug);

  redirect(`/booking/${hosted.slug}?${qs.toString()}`);
}
