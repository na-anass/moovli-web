"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { studioApi } from "@/lib/api/studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlusIcon, ClockIcon, Trash2Icon } from "lucide-react";
import { formatMoneyWhole } from "@/lib/money";
import { useDialogs } from "@/components/shared/dialogs";
import { PanelHeading } from "./PanelHeading";
import type { OnboardingData, ServiceRow } from "../_lib/useOnboarding";

// Mon-first week. JS getDay() is Sun=0, so we convert.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_TOKENS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DEFAULT_TIMES = ["09:00", "11:00", "17:00", "18:00", "10:00", "12:00", "19:00"];

interface PlannedCard {
  tempId: string;
  persistedId: string | null;
  dayIndex: number; // 0 = Mon … 6 = Sun
  time: string; // HH:mm
  serviceId: string;
  providerId: string | null;
  capacity: number;
  price: number;
  repeatWeekly: boolean;
}

/** Next calendar date (>= now) whose weekday matches a Mon-first index, at HH:mm. */
function nextDateForWeekday(dayIndexMon0: number, time: string): Date {
  const now = new Date();
  const jsTarget = (dayIndexMon0 + 1) % 7; // Mon(0)->1 … Sun(6)->0
  const [h, m] = time.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  let diff = (jsTarget - d.getDay() + 7) % 7;
  if (diff === 0 && d <= now) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekdayMon0(iso: string): number {
  const js = new Date(iso).getDay(); // Sun=0
  return (js + 6) % 7; // -> Mon=0
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PlanningStage({
  data,
  commitRef,
}: {
  data: OnboardingData;
  commitRef: React.MutableRefObject<(() => Promise<boolean>) | null>;
}) {
  const { entityId, services, providers, currency, existingSessions, flashSaved } = data;
  const { notify } = useDialogs();
  const t = useTranslations("onboarding");
  const [cards, setCards] = useState<PlannedCard[]>([]);
  const [editing, setEditing] = useState<PlannedCard | null>(null);
  const [seeded, setSeeded] = useState(false);
  const tempIdCounter = useRef(0);

  const serviceById = useMemo(() => {
    const m = new Map<string, ServiceRow>();
    services.forEach((s) => m.set(s.id, s));
    return m;
  }, [services]);

  // Seed once, when the async studio data lands: resume from existing draft
  // sessions, else auto-suggest a starter grid from the services. This is a
  // deliberate one-shot derive-from-props-on-arrival (guarded by `seeded`), not
  // a render loop.
  useEffect(() => {
    if (seeded || services.length === 0) return;

    const next: PlannedCard[] =
      existingSessions.length > 0
        ? existingSessions
            .filter((s) => s.service_id && serviceById.has(s.service_id))
            .map((s, i) => ({
              tempId: `exist-${i}`,
              persistedId: s.id,
              dayIndex: weekdayMon0(s.start_time),
              time: hhmm(s.start_time),
              serviceId: s.service_id as string,
              providerId: s.provider_id ?? null,
              capacity: s.capacity,
              price: s.price_mad,
              repeatWeekly: false,
            }))
        : services.map((s, i) => ({
            tempId: `sugg-${i}`,
            persistedId: null,
            dayIndex: i % 5, // spread Mon–Fri
            time: DEFAULT_TIMES[i % DEFAULT_TIMES.length],
            serviceId: s.id,
            providerId: providers[0]?.id ?? null,
            capacity: s.capacity,
            price: s.base_price,
            repeatWeekly: false,
          }));

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCards(next);
    setSeeded(true);
  }, [seeded, services, providers, existingSessions, serviceById]);

  // Register the commit handler the orchestrator calls on "Continue".
  useEffect(() => {
    commitRef.current = async () => {
      try {
        const updated = [...cards];
        for (let i = 0; i < updated.length; i++) {
          const c = updated[i];
          if (c.persistedId) continue;
          const svc = serviceById.get(c.serviceId);
          if (!svc) continue;
          const start = nextDateForWeekday(c.dayIndex, c.time);
          const end = new Date(start.getTime() + svc.duration_minutes * 60_000);
          const res = await studioApi.createSession(entityId, {
            service_id: c.serviceId,
            provider_id: c.providerId ?? undefined,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            capacity: Number(c.capacity),
            price_mad: Number(c.price),
            ...(c.repeatWeekly
              ? {
                  recurrence: {
                    frequency: "weekly",
                    by_weekday: [DAY_TOKENS[c.dayIndex]],
                    count: 8,
                  },
                }
              : {}),
          });
          updated[i] = { ...c, persistedId: res.data?.id ?? "saved" };
        }
        setCards(updated);
        flashSaved();
        return true;
      } catch (e) {
        notify((e as Error).message, { variant: "error" });
        return false;
      }
    };
    return () => {
      commitRef.current = null;
    };
  }, [cards, entityId, serviceById, flashSaved, commitRef, notify]);

  const addCard = (dayIndex: number) => {
    const svc = services[0];
    if (!svc) return;
    setEditing({
      tempId: `new-${tempIdCounter.current++}`,
      persistedId: null,
      dayIndex,
      time: "18:00",
      serviceId: svc.id,
      providerId: providers[0]?.id ?? null,
      capacity: svc.capacity,
      price: svc.base_price,
      repeatWeekly: false,
    });
  };

  const saveEditing = (card: PlannedCard) => {
    setCards((prev) => {
      const exists = prev.some((c) => c.tempId === card.tempId);
      return exists ? prev.map((c) => (c.tempId === card.tempId ? card : c)) : [...prev, card];
    });
    setEditing(null);
  };

  const removeCard = async (card: PlannedCard) => {
    setCards((prev) => prev.filter((c) => c.tempId !== card.tempId));
    if (card.persistedId && card.persistedId !== "saved") {
      try {
        await studioApi.deleteSession(entityId, card.persistedId);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const total = cards.length;

  const openNewCard = () => {
    // Default to today's column (Mon-first). Computed in the handler, not during
    // render, so it stays out of the render-purity path.
    const todayMon0 = (new Date().getDay() + 6) % 7;
    addCard(todayMon0);
  };

  return (
    <div>
      <PanelHeading
        title={t("planning.title")}
        subtitle={t("planning.subtitle")}
      />

      {/* Always-visible add action + live count */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t.rich("planning.classesThisWeek", {
            count: total,
            strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
          })}
        </p>
        <Button size="sm" onClick={openNewCard} disabled={services.length === 0}>
          <PlusIcon className="mr-1.5 size-4" /> {t("planning.addClass")}
        </Button>
      </div>

      {services.length === 0 && (
        <p className="mb-4 rounded-lg border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground">
          {t("planning.noServices")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DAYS.map((day, dayIndex) => {
          const dayCards = cards
            .filter((c) => c.dayIndex === dayIndex)
            .sort((a, b) => a.time.localeCompare(b.time));
          return (
            <div
              key={day}
              className="flex min-h-[9rem] flex-col rounded-lg border bg-muted/20 p-2"
            >
              <div className="mb-2 text-center text-xs font-semibold text-muted-foreground">
                {t(`planning.days.${DAY_TOKENS[dayIndex]}`)}
              </div>
              <div className="flex-1 space-y-1.5">
                {dayCards.length === 0 && (
                  <p className="py-3 text-center text-[11px] italic text-muted-foreground/70">
                    {t("planning.noClass")}
                  </p>
                )}
                {dayCards.map((c) => {
                  const svc = serviceById.get(c.serviceId);
                  const provider = providers.find((p) => p.id === c.providerId);
                  return (
                    <button
                      key={c.tempId}
                      type="button"
                      onClick={() => setEditing(c)}
                      className="w-full rounded-md border-l-2 border-l-primary bg-card p-2 text-left transition"
                    >
                      <div className="text-xs font-bold">{c.time}</div>
                      <div className="truncate text-xs font-medium">{svc?.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ClockIcon className="size-2.5" />
                        {provider?.name ?? t("planning.noInstructor")} ·{" "}
                        {t("planning.spots", { count: c.capacity })}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => addCard(dayIndex)}
                className="mt-1.5 flex items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
              >
                <PlusIcon className="size-3" /> {t("planning.add")}
              </button>
            </div>
          );
        })}
      </div>

      {/* Card editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {editing && (
            <CardEditor
              card={editing}
              services={services}
              providers={providers}
              currency={currency}
              onSave={saveEditing}
              onRemove={() => {
                removeCard(editing);
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CardEditor({
  card,
  services,
  providers,
  currency,
  onSave,
  onRemove,
}: {
  card: PlannedCard;
  services: ServiceRow[];
  providers: { id: string; name: string }[];
  currency: string;
  onSave: (card: PlannedCard) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("onboarding");
  const [draft, setDraft] = useState<PlannedCard>(card);
  const set = (patch: Partial<PlannedCard>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("planning.editor.title")}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-sm font-medium">
            {t("planning.editor.service")}
            <InfoTip term="service" />
          </label>
          <Select value={draft.serviceId} onValueChange={(v) => set({ serviceId: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("planning.editor.day")}</label>
            <Select
              value={String(draft.dayIndex)}
              onValueChange={(v) => set({ dayIndex: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={d} value={String(i)}>
                    {t(`planning.days.${DAY_TOKENS[i]}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("planning.editor.startTime")}</label>
            <Input
              type="time"
              value={draft.time}
              onChange={(e) => set({ time: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1 text-sm font-medium">
            {t("planning.editor.instructor")}
            <InfoTip term="instructor" />
          </label>
          <Select
            value={draft.providerId ?? "none"}
            onValueChange={(v) => set({ providerId: v === "none" ? null : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("planning.noInstructor")}</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-sm font-medium">
              {t("planning.editor.capacity")}
              <InfoTip term="capacity" />
            </label>
            <Input
              type="number"
              min={1}
              value={draft.capacity}
              onChange={(e) => set({ capacity: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("planning.editor.price", { currency })}
            </label>
            <Input
              type="number"
              min={0}
              value={draft.price}
              onChange={(e) => set({ price: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
          <div>
            <div className="text-sm font-medium">{t("planning.editor.repeatWeekly")}</div>
            <div className="text-xs text-muted-foreground">
              {t("planning.editor.repeatWeeklyHint")}
            </div>
          </div>
          <Switch
            checked={draft.repeatWeekly}
            onCheckedChange={(v) => set({ repeatWeekly: v })}
            disabled={!!draft.persistedId}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {formatMoneyWhole(draft.price, currency)} ·{" "}
          {t("planning.spots", { count: draft.capacity })}
        </p>
      </div>

      <DialogFooter className="flex-row justify-between sm:justify-between">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2Icon className="mr-1.5 size-4" /> {t("planning.editor.remove")}
        </Button>
        <Button onClick={() => onSave(draft)}>{t("planning.editor.done")}</Button>
      </DialogFooter>
    </>
  );
}
