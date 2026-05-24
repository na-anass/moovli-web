import { redirect } from "next/navigation";

// The channels index page is no longer surfaced in the sidebar — Marketplace and
// Direct are top-level nav items. Anyone landing here gets sent to Direct, which
// is the always-available channel (Marketplace is plan-gated).
export default function StudioChannelsRedirectPage() {
  redirect("/studio/channels/direct");
}
