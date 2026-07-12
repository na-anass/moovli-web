"use client";

import { useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSheet } from "@/components/shared/form-sheet";
import {
  ProviderForm,
  EMPTY_PROVIDER_FORM,
  providerToForm,
  providerFormToPayload,
  isProviderFormValid,
  type ProviderFormValues,
} from "@/components/studio/provider-form";
import { useDialogs } from "@/components/shared/dialogs";
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import { PanelHeading } from "./PanelHeading";
import { initialsOf, toProviderRow, type OnboardingData, type ProviderRow } from "../_lib/useOnboarding";

export function TeamPanel({ data }: { data: OnboardingData }) {
  const { entityId, providers, setProviders, currency, flashSaved } = data;
  const { notify } = useDialogs();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderFormValues>(EMPTY_PROVIDER_FORM);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_PROVIDER_FORM);
    setOpen(true);
  };

  const openEdit = (row: ProviderRow) => {
    setEditingId(row.id);
    setForm(providerToForm(row));
    setOpen(true);
  };

  const save = async () => {
    if (!isProviderFormValid(form)) {
      notify("Please enter the instructor's name.", { title: "Almost there" });
      return;
    }
    setSaving(true);
    try {
      const payload = providerFormToPayload(form);
      if (editingId) {
        const res = await studioApi.updateProvider(entityId, editingId, payload);
        const row = toProviderRow({ ...res.data, id: editingId });
        setProviders((prev) => prev.map((p) => (p.id === editingId ? row : p)));
      } else {
        const res = await studioApi.createProvider(entityId, payload);
        setProviders((prev) => [...prev, toProviderRow(res.data)]);
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
    const prev = providers;
    setProviders((list) => list.filter((p) => p.id !== id));
    try {
      await studioApi.deleteProvider(entityId, id);
      flashSaved();
    } catch (e) {
      setProviders(prev);
      notify((e as Error).message, { variant: "error" });
    }
  };

  return (
    <div>
      <PanelHeading
        title="Your team"
        subtitle="Add your instructors so you can assign them to classes. This step is optional."
      />

      <div className="space-y-2.5">
        {providers.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.avatar_url}
                alt={p.name}
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initialsOf(p.name) || "?"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{p.name}</span>
                {p.is_featured && <StarIcon className="size-3 fill-current text-amber-500" />}
                {!p.is_active && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    Inactive
                  </Badge>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {[p.title, p.email].filter(Boolean).join(" · ") || "Instructor"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={() => openEdit(p)}
            >
              <PencilIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => remove(p.id)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" className="mt-3 w-full border-dashed" onClick={openCreate}>
        <PlusIcon className="mr-1.5 size-4" /> Add an instructor
      </Button>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Edit instructor" : "Add instructor"}
        subtitle={
          editingId
            ? "Update this instructor's profile."
            : "Add someone who teaches at your studio. Add an email to give them a login."
        }
        icon={editingId ? PencilIcon : UserPlusIcon}
        iconAccent="primary"
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !isProviderFormValid(form)}>
              {saving ? "Saving…" : editingId ? "Update instructor" : "Add instructor"}
            </Button>
          </>
        }
      >
        <ProviderForm form={form} setForm={setForm} currency={currency} />
      </FormSheet>
    </div>
  );
}
