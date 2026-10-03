"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoneyWhole } from "@/lib/money";
import type { InsightsService } from "@/lib/api/studio";

/**
 * Which services earn, and which ones run half-empty.
 *
 * Fill is shown as a bar as well as a number because the comparison between
 * rows is the point — the exact percentage rarely is. The bar turns amber below
 * 50% so a struggling service is visible while scanning.
 */
export function ServicesTable({
  services,
  currency,
}: {
  services: InsightsService[];
  currency: string;
}) {
  const t = useTranslations("studioMain.insights");

  if (services.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t("services.empty")}</p>;
  }

  const totals = services.reduce(
    (acc, s) => ({
      sessions: acc.sessions + s.sessions,
      bookings: acc.bookings + s.bookings,
      revenue: acc.revenue + s.revenue,
    }),
    { sessions: 0, bookings: 0, revenue: 0 },
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("services.service")}</TableHead>
            <TableHead className="text-right">{t("services.sessions")}</TableHead>
            <TableHead className="text-right">{t("services.bookings")}</TableHead>
            <TableHead className="text-right">{t("services.fill")}</TableHead>
            <TableHead className="text-right">{t("services.revenue")}</TableHead>
            <TableHead className="text-right">{t("services.averageBasket")}</TableHead>
            <TableHead>{t("sources.marketplace")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => {
            const fill = service.capacity > 0 ? Math.round((service.booked / service.capacity) * 100) : 0;
            // Same population as the revenue beside it — not every booking earns.
            const basket = service.delivered > 0 ? Math.round(service.revenue / service.delivered) : 0;
            return (
              <TableRow key={service.id}>
                <TableCell>
                  <p className="font-medium">{service.name}</p>
                  {service.durationMinutes != null && (
                    <p className="text-xs text-muted-foreground">
                      {t("services.duration", { minutes: service.durationMinutes })}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{service.sessions}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {service.bookings}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2.5">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <span
                        className={`block h-full rounded-full ${fill < 50 ? "bg-amber-500" : "bg-secondary"}`}
                        style={{ width: `${Math.min(100, fill)}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-sm font-semibold tabular-nums">
                      {fill}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoneyWhole(service.revenue, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoneyWhole(basket, currency)}
                </TableCell>
                <TableCell>
                  {service.listedOnMarketplace ? (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                      {t("services.listed")}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{t("services.notListed")}</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-medium">{t("services.total")}</TableCell>
            <TableCell className="text-right tabular-nums">{totals.sessions}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {totals.bookings}
            </TableCell>
            <TableCell />
            <TableCell className="text-right font-semibold tabular-nums">
              {formatMoneyWhole(totals.revenue, currency)}
            </TableCell>
            <TableCell />
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
