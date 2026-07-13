"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/datetime";
import { useParams, useRouter } from "next/navigation";
import { instructorApi } from "@/lib/api/instructor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { ArrowLeftIcon, CheckCircleIcon } from "lucide-react";

interface Attendee {
  id: string;
  user_id: string;
  status: string;
  credits_cost: number;
  checked_in_at: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  checked_in: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  no_show: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function SessionAttendeesPage() {
  const t = useTranslations("instructor");
  const tc = useTranslations("common");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    instructorApi
      .getSessionAttendees(id)
      .then((res) => setAttendees(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleCheckin = async (bookingId: string) => {
    setCheckingIn(bookingId);
    try {
      await instructorApi.checkinAttendee(id, bookingId);
      setAttendees((prev) =>
        prev.map((a) =>
          a.id === bookingId
            ? { ...a, status: "checked_in", checked_in_at: new Date().toISOString() }
            : a
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingIn(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const confirmed = attendees.filter((a) => a.status === "confirmed").length;
  const checkedIn = attendees.filter((a) => a.status === "checked_in").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label={tc("back")}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-2xl font-bold inline-flex items-center gap-1.5">
          {t("session.title")}
          <InfoTip term="checkin" />
        </h1>
        <Badge variant="outline">{t("session.totalCount", { count: attendees.length })}</Badge>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          {t("session.confirmed")}{" "}
          <span className="font-medium text-foreground">{confirmed}</span>
        </span>
        <span className="text-muted-foreground">
          {t("session.checkedIn")}{" "}
          <span className="font-medium text-foreground">{checkedIn}</span>
        </span>
      </div>

      {attendees.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">{t("session.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attendees.map((attendee) => (
            <div
              key={attendee.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                  {attendee.user_id.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {t("session.userLabel", { id: attendee.user_id.substring(0, 8) })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("session.bookedOn", { date: formatDate(attendee.created_at) })}
                    {attendee.credits_cost > 0 &&
                      ` — ${t("session.creditsCost", { credits: attendee.credits_cost })}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={statusColors[attendee.status] || ""}>
                  {attendee.status.replace("_", " ")}
                </Badge>
                {attendee.status === "confirmed" && (
                  <Button
                    size="sm"
                    onClick={() => handleCheckin(attendee.id)}
                    disabled={checkingIn === attendee.id}
                  >
                    <CheckCircleIcon className="size-4 mr-1" />
                    {checkingIn === attendee.id ? "..." : t("session.checkIn")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
