"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/lib/use-is-mobile";
import { formatMoneyWhole } from "@/lib/money";
import { formatDateFull, formatTimeRange } from "@/lib/datetime";
import { ArrowUpRightIcon, CalendarIcon, ClockIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { GuestBookingForm } from "./session/[sessionId]/guest-booking-form";

export interface BookingSheetSession {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  price_mad: number;
  service: { id: string; name: string; duration_minutes: number } | null;
  provider: { id: string; name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: BookingSheetSession | null;
  studioSlug: string;
  entityId: string;
  channelId: string;
  brandColor?: string | null;
  currency: string;
}


export function BookingSheet({
  open,
  onOpenChange,
  session,
  studioSlug,
  entityId,
  channelId,
  brandColor,
  currency,
}: Props) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[92vh] rounded-t-xl overflow-y-auto"
            : "w-full sm:max-w-lg overflow-y-auto"
        }
      >
        {!session ? (
          <div className="p-6 text-sm text-muted-foreground">No session selected.</div>
        ) : (
          <>
            <SheetHeader className="space-y-1.5">
              <SheetTitle className="text-xl">{session.service?.name ?? "Session"}</SheetTitle>
              <SheetDescription className="space-y-1">
                <span className="flex items-center gap-1.5 text-sm">
                  <CalendarIcon className="size-3.5" />
                  {formatDateFull(session.start_time)}
                </span>
                <span className="flex items-center gap-1.5 text-sm">
                  <ClockIcon className="size-3.5" />
                  {formatTimeRange(session.start_time, session.end_time)}
                  {session.service?.duration_minutes && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {session.service.duration_minutes} min
                    </span>
                  )}
                </span>
                {session.provider?.name && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className="inline-block size-1 rounded-full bg-current opacity-50" />
                    with {session.provider.name}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-sm">
                  <UsersIcon className="size-3.5" />
                  {session.capacity - session.booked_count} of {session.capacity} spots remaining
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="px-4">
              <div className="border-y py-4 my-4 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Price</span>
                <div className="text-right">
                  <div
                    className="text-2xl font-bold leading-none"
                    style={brandColor ? { color: brandColor } : undefined}
                  >
                    {formatMoneyWhole(session.price_mad, currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Pay at studio</div>
                </div>
              </div>

              <GuestBookingForm
                sessionId={session.id}
                entityId={entityId}
                serviceId={session.service?.id ?? ""}
                channelId={channelId}
                studioSlug={studioSlug}
                priceMad={Number(session.price_mad)}
                currency={currency}
              />

              <Link
                href={`/booking/${studioSlug}/session/${session.id}`}
                className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Open full session page <ArrowUpRightIcon className="size-3" />
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
