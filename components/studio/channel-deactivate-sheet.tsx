"use client";

import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import {
  studioApi,
  type ChannelDeactivationPolicy,
  type ChannelDeactivationType,
  type ChannelImpact,
} from "@/lib/api/studio";
import {
  AlertCircleIcon,
  ArchiveIcon,
  EyeOffIcon,
  PowerOffIcon,
  ShareIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

// ============================================================================
// ChannelDeactivateSheet
//
// Confirmation sheet shown when a studio is about to turn OFF a channel that
// has live sessions/allocations. Surfaces an impact summary up front, then
// asks for a redistribution policy:
//
//   - release   → channel pref off, per-channel seats merge into the shared
//                 pool of remaining live channels. Session_channels rows
//                 remain so re-enabling resumes where it left off.
//   - unpublish → channel pref off, session_channels rows DELETED. Sessions
//                 with no other channel go dark until re-published. Used when
//                 the studio is permanently winding down the channel.
//   - keep      → channel pref off only. Sessions + allocations untouched.
//                 Short pauses (closed for a week).
//
// Existing confirmed bookings are NEVER touched. Surfaced in the impact row
// for reassurance.
// ============================================================================

const CHANNEL_LABEL: Record<ChannelDeactivationType, string> = {
  marketplace: "Marketplace",
  direct_hosted: "Direct booking page",
  direct_link: "Custom link",
  direct_embed: "Widget",
};

interface PolicyOption {
  value: ChannelDeactivationPolicy;
  label: string;
  description: string;
  icon: React.ElementType;
  recommended?: boolean;
}

const POLICIES: PolicyOption[] = [
  {
    value: "release",
    label: "Release to remaining channels",
    description:
      "Sessions stay published; dedicated seats merge into the shared pool so other channels can book them.",
    icon: ShareIcon,
    recommended: true,
  },
  {
    value: "unpublish",
    label: "Unpublish from this channel only",
    description:
      "Sessions stay live on other channels they're published to. If this was a session's only channel, it goes to draft until re-published.",
    icon: EyeOffIcon,
  },
  {
    value: "keep",
    label: "Keep everything as-is, just hide the surface",
    description:
      "Sessions stay published in the database but no one can find the channel. Use this for short pauses (e.g. closing for a week).",
    icon: ArchiveIcon,
  },
];

interface ChannelDeactivateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  channelType: ChannelDeactivationType;
  onDeactivated: () => void;
}

export function ChannelDeactivateSheet({
  open,
  onOpenChange,
  entityId,
  channelType,
  onDeactivated,
}: ChannelDeactivateSheetProps) {
  const [impact, setImpact] = useState<ChannelImpact | null>(null);
  const [policy, setPolicy] = useState<ChannelDeactivationPolicy>("release");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch impact each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    studioApi
      .getChannelImpact(entityId, channelType)
      .then((res) => {
        if (!cancelled) setImpact(res.data);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityId, channelType]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await studioApi.deactivateChannel(entityId, channelType, policy);
      onDeactivated();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const channelLabel = CHANNEL_LABEL[channelType];
  const hasAnyImpact =
    impact &&
    (impact.upcoming_sessions > 0 ||
      impact.allocated_seats > 0 ||
      impact.confirmed_bookings > 0);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Turn off ${channelLabel}?`}
      subtitle="Decide what should happen to sessions already published here."
      icon={PowerOffIcon}
      iconAccent="amber"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || submitting}
          >
            {submitting ? "Turning off…" : `Turn off ${channelLabel.toLowerCase()}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Impact summary */}
        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Impact on current data
          </h3>
          {loading ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Checking…
            </div>
          ) : impact && hasAnyImpact ? (
            <ul className="rounded-lg border border-amber-200 bg-amber-50/50 divide-y divide-amber-200/60 text-sm">
              {impact.upcoming_sessions > 0 && (
                <ImpactRow
                  label="Upcoming sessions published here"
                  value={impact.upcoming_sessions}
                />
              )}
              {impact.allocated_seats > 0 && (
                <ImpactRow
                  label="Seats dedicated via split allocation"
                  value={impact.allocated_seats}
                />
              )}
              {impact.confirmed_bookings > 0 && (
                <ImpactRow
                  label="Confirmed bookings — stay valid regardless"
                  value={impact.confirmed_bookings}
                  preserved
                />
              )}
              {impact.only_channel_sessions > 0 && policy === "unpublish" && (
                <li className="flex items-start gap-2 px-3 py-2.5 text-xs text-amber-900">
                  <AlertCircleIcon className="size-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>{impact.only_channel_sessions}</strong>{" "}
                    {impact.only_channel_sessions === 1 ? "session has" : "sessions have"}{" "}
                    no other channel — they&apos;ll go to draft until re-published.
                  </span>
                </li>
              )}
            </ul>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              No active sessions or allocations on this channel right now.
            </div>
          )}
        </section>

        {/* Policy picker */}
        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            What should happen to those sessions?
          </h3>
          <div className="space-y-2">
            {POLICIES.map((p) => {
              const Icon = p.icon;
              const active = policy === p.value;
              return (
                <label
                  key={p.value}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "hover:bg-accent/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="deactivate_policy"
                    value={p.value}
                    checked={active}
                    onChange={() => setPolicy(p.value)}
                    className="size-4 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{p.label}</span>
                      {p.recommended && (
                        <span className="text-[10px] uppercase tracking-wider rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>
    </FormSheet>
  );
}

// ============================================================================
// Single row in the impact summary list.
// ============================================================================

function ImpactRow({
  label,
  value,
  preserved,
}: {
  label: string;
  value: number;
  preserved?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-xs text-amber-900">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          preserved ? "text-emerald-700" : "text-amber-900"
        }`}
      >
        {value}
      </span>
    </li>
  );
}
