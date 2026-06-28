"use client";

import { BaseLayout } from "@/components/layout/base-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  platformSettingsApi,
  type PlatformSetting,
} from "@/lib/api/platformSettings";
import {
  BookOpenIcon,
  CheckIcon,
  CoinsIcon,
  GlobeIcon,
  RefreshCwIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateCustom } from "@/lib/datetime";

// ============================================================================
// Category styling — icon + accent per group of settings
// ============================================================================

const CATEGORY_META: Record<
  string,
  { label: string; description: string; icon: React.ElementType }
> = {
  credits: {
    label: "Credits",
    description: "How credits convert to currency and how long they last.",
    icon: CoinsIcon,
  },
  pricing: {
    label: "Pricing",
    description: "Bounds on the dynamic marketplace markup.",
    icon: TrendingUpIcon,
  },
  subscriptions: {
    label: "Subscriptions",
    description: "Trial duration, grace periods, plan defaults.",
    icon: RefreshCwIcon,
  },
  bookings: {
    label: "Bookings",
    description: "Default windows and rules used when a service doesn't specify its own.",
    icon: BookOpenIcon,
  },
  general: {
    label: "General",
    description: "Platform-wide defaults like currency.",
    icon: GlobeIcon,
  },
};

const CATEGORY_ORDER = ["credits", "pricing", "subscriptions", "bookings", "general"];

// ============================================================================
// Page
// ============================================================================

export default function AdminPoliciesPage() {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformSettingsApi.list();
      setSettings(res.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onSaved = (updated: PlatformSetting) => {
    setSettings((prev) => prev.map((s) => (s.key === updated.key ? updated : s)));
  };

  const grouped = useMemo(() => {
    const map = new Map<string, PlatformSetting[]>();
    settings.forEach((s) => {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    });
    // Stable order: known categories first, then any unknowns alphabetically.
    const orderedKeys = [
      ...CATEGORY_ORDER.filter((k) => map.has(k)),
      ...[...map.keys()].filter((k) => !CATEGORY_ORDER.includes(k)).sort(),
    ];
    return orderedKeys.map((category) => ({
      category,
      items: (map.get(category) ?? []).sort((a, b) => a.key.localeCompare(b.key)),
    }));
  }, [settings]);

  return (
    <BaseLayout
      maxWidth="lg"
      icon={SlidersHorizontalIcon}
      title="Policies"
      subtitle="Tune platform-wide knobs without a deploy. Changes take effect within a minute (60s service cache)."
    >
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading policies…</div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ category, items }) => {
            const meta =
              CATEGORY_META[category] ?? {
                label: category,
                description: "",
                icon: SettingsIcon,
              };
            const Icon = meta.icon;
            return (
              <section key={category}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base">{meta.label}</h2>
                    {meta.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {meta.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border bg-card divide-y">
                  {items.map((s) => (
                    <SettingRow key={s.key} setting={s} onSaved={onSaved} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </BaseLayout>
  );
}

// ============================================================================
// Row — view ↔ edit, typed widget per data_type
// ============================================================================

function SettingRow({
  setting,
  onSaved,
}: {
  setting: PlatformSetting;
  onSaved: (s: PlatformSetting) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(() => stringifyForEdit(setting));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const startEdit = () => {
    setDraft(stringifyForEdit(setting));
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(stringifyForEdit(setting));
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const parsed = parseForApi(draft, setting.data_type);
      const res = await platformSettingsApi.update(setting.key, parsed);
      onSaved(res.data);
      setEditing(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
      {/* Label + description */}
      <div className="sm:flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{setting.label}</span>
          <code className="text-[10px] rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
            {setting.key}
          </code>
          {setting.is_public && (
            <Badge
              variant="outline"
              className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700"
            >
              Public
            </Badge>
          )}
        </div>
        {setting.description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            {setting.description}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Last updated{" "}
          {formatDateCustom(setting.updated_at, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Value editor */}
      <div className="sm:w-72 shrink-0">
        {editing ? (
          <div className="space-y-2">
            <ValueWidget
              dataType={setting.data_type}
              value={draft}
              onChange={setDraft}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <ValueDisplay setting={setting} />
            {savedFlash && (
              <span className="inline-flex items-center text-xs text-emerald-600">
                <CheckIcon className="size-3 mr-1" /> Saved
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={startEdit}>
              Edit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// View widgets — render current value compactly per type
// ============================================================================

function ValueDisplay({ setting }: { setting: PlatformSetting }) {
  if (setting.data_type === "boolean") {
    return (
      <Badge variant="outline" className="font-mono">
        {setting.value ? "true" : "false"}
      </Badge>
    );
  }
  if (setting.data_type === "json") {
    return (
      <code className="text-xs rounded bg-muted px-1.5 py-0.5 font-mono max-w-[180px] truncate">
        {JSON.stringify(setting.value)}
      </code>
    );
  }
  // number / string
  return (
    <span className="text-sm font-medium tabular-nums">
      {typeof setting.value === "string" ? `"${setting.value}"` : String(setting.value)}
    </span>
  );
}

// ============================================================================
// Edit widgets
// ============================================================================

function ValueWidget({
  dataType,
  value,
  onChange,
}: {
  dataType: PlatformSetting["data_type"];
  value: string;
  onChange: (v: string) => void;
}) {
  if (dataType === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={value === "true"}
          onCheckedChange={(v) => onChange(v ? "true" : "false")}
        />
        <span className="text-sm">{value === "true" ? "true" : "false"}</span>
      </div>
    );
  }
  if (dataType === "json") {
    return (
      <Textarea
        rows={4}
        className="font-mono text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (dataType === "number") {
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  // string
  return <Input value={value} onChange={(e) => onChange(e.target.value)} />;
}

// ============================================================================
// String <-> JSON conversion for editing
// Settings store JSON in DB but edit as plain strings. Parse on save.
// ============================================================================

function stringifyForEdit(s: PlatformSetting): string {
  switch (s.data_type) {
    case "string":
      return String(s.value ?? "");
    case "number":
      return s.value == null ? "" : String(s.value);
    case "boolean":
      return s.value ? "true" : "false";
    case "json":
    default:
      return JSON.stringify(s.value, null, 2);
  }
}

function parseForApi(input: string, dataType: PlatformSetting["data_type"]): unknown {
  switch (dataType) {
    case "string":
      return input;
    case "number": {
      const n = Number(input);
      if (!Number.isFinite(n)) throw new Error("Not a valid number");
      return n;
    }
    case "boolean":
      return input === "true";
    case "json":
    default:
      try {
        return JSON.parse(input);
      } catch {
        throw new Error("Not valid JSON");
      }
  }
}
