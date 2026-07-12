"use client";

import { useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/shared/form-sheet";
import {
  ServiceForm,
  EMPTY_SERVICE_FORM,
  serviceToForm,
  serviceFormToPayload,
  isServiceFormValid,
  type ServiceFormValues,
} from "@/components/studio/service-form";
import { useDialogs } from "@/components/shared/dialogs";
import { formatMoneyWhole } from "@/lib/money";
import { PackageIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { PanelHeading } from "./PanelHeading";
import { toServiceRow, type OnboardingData, type ServiceRow } from "../_lib/useOnboarding";

const QUICK_ADD = ["Yoga", "Pilates", "HIIT", "Strength", "Dance", "Spa & Wellness"];

export function ServicesPanel({ data }: { data: OnboardingData }) {
  const { entityId, services, setServices, categories, currency, flashSaved } = data;
  const { notify } = useDialogs();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceFormValues>(EMPTY_SERVICE_FORM);
  const [saving, setSaving] = useState(false);

  const openCreate = (name = "") => {
    setEditingId(null);
    setForm({ ...EMPTY_SERVICE_FORM, name });
    setOpen(true);
  };

  const openEdit = (row: ServiceRow) => {
    setEditingId(row.id);
    setForm(serviceToForm(row));
    setOpen(true);
  };

  const save = async () => {
    if (!isServiceFormValid(form)) {
      notify("Please fill in the name, duration, capacity and price.", {
        title: "Almost there",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = serviceFormToPayload(form);
      if (editingId) {
        const res = await studioApi.updateService(entityId, editingId, payload);
        const row = toServiceRow({ ...res.data, id: editingId });
        setServices((prev) => prev.map((s) => (s.id === editingId ? row : s)));
      } else {
        const res = await studioApi.createService(entityId, payload);
        setServices((prev) => [...prev, toServiceRow(res.data)]);
      }
      flashSaved();
      setOpen(false);
    } catch (e) {
      notify((e as Error).message, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const prev = services;
    setServices((list) => list.filter((s) => s.id !== id));
    try {
      await studioApi.deleteService(entityId, id);
      flashSaved();
    } catch (e) {
      setServices(prev);
      notify((e as Error).message, { variant: "error" });
    }
  };

  const categoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? null) : null;

  return (
    <div>
      <PanelHeading
        title="Your services"
        subtitle="Add the classes or sessions you offer. You can add more later."
      />

      {/* Quick-add chips open the full form pre-filled with the name */}
      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_ADD.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => openCreate(name)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm transition hover:border-primary/60 hover:bg-accent"
          >
            <PlusIcon className="size-3.5" />
            {name}
          </button>
        ))}
      </div>

      {/* Service summary cards */}
      <div className="space-y-2.5">
        {services.map((s) => {
          const cat = categoryName(s.category_id);
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PackageIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{s.name}</span>
                  {s.is_featured && <StarIcon className="size-3 fill-current text-amber-500" />}
                  {cat && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {cat}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.duration_minutes} min · {formatMoneyWhole(s.base_price, currency)} ·{" "}
                  {s.capacity} spots
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={() => openEdit(s)}
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => remove(s.id)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        variant="outline"
        className="mt-3 w-full border-dashed"
        onClick={() => openCreate()}
      >
        <PlusIcon className="mr-1.5 size-4" /> Add a service
      </Button>

      {services.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Add at least one service to continue — tap a suggestion above to start.
        </p>
      )}

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Edit service" : "New service"}
        subtitle="What people book — a class, a session, a treatment."
        icon={PackageIcon}
        iconAccent="violet"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !isServiceFormValid(form)}>
              {saving ? "Saving…" : editingId ? "Update service" : "Create service"}
            </Button>
          </>
        }
      >
        <ServiceForm form={form} setForm={setForm} categories={categories} currency={currency} />
      </FormSheet>
    </div>
  );
}
