"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { CheckIcon, PaletteIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const DEFAULT_COLOR = "#f26c2c"; // Moovli orange fallback

const PRESETS = [
  { label: "Moovli orange", value: "#f26c2c" },
  { label: "Magenta", value: "#d946ef" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Slate", value: "#64748b" },
];

export default function BrandingSettingsPage() {
  const { roles } = useAuth();
  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const role = roles?.ownedEntities?.[0]?.role;
  const canManage = role === "owner" || role === "manager" || roles?.isAdmin;

  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [originalColor, setOriginalColor] = useState<string>(DEFAULT_COLOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchBrand = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await studioApi.getBranding(entityId);
      const c = res.data.primary_color ?? DEFAULT_COLOR;
      setColor(c);
      setOriginalColor(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchBrand();
  }, [fetchBrand]);

  const handleSave = async () => {
    if (!entityId) return;
    setSaving(true);
    try {
      await studioApi.updateBranding(entityId, color);
      setOriginalColor(color);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!entityId) return;
    setSaving(true);
    try {
      await studioApi.updateBranding(entityId, null);
      setColor(DEFAULT_COLOR);
      setOriginalColor(DEFAULT_COLOR);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!entityId) {
    return <div className="p-8 text-muted-foreground">No studio access found.</div>;
  }

  const isDirty = color !== originalColor;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Your brand color appears on your public booking page — session card borders,
          price, the primary Book button, and logo accent.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="rounded-lg border p-6 space-y-5">
          <div>
            <h2 className="text-sm font-medium flex items-center gap-2 mb-3">
              <PaletteIcon className="size-4" />
              Primary color
            </h2>

            {/* Picker + hex input + native color input */}
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={!canManage}
                className="size-12 rounded border cursor-pointer disabled:cursor-not-allowed"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value.toLowerCase())}
                disabled={!canManage}
                placeholder="#f26c2c"
                className="w-32 h-12 font-mono text-sm"
              />
              <span className="text-xs text-muted-foreground">Click swatch to pick, or type a hex code.</span>
            </div>

            {/* Presets */}
            <div className="mt-4 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => canManage && setColor(p.value)}
                  disabled={!canManage}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs hover:bg-accent disabled:opacity-50"
                >
                  <span
                    className="size-3 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: p.value }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="border-t pt-5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Preview
            </h3>
            <div className="rounded-lg border p-4 space-y-3" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-semibold">18:00 · Yoga Flow</div>
                  <div className="text-xs text-muted-foreground">60 min · with Sara</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold" style={{ color }}>100 MAD</div>
                  <div className="text-[10px] text-muted-foreground">at studio</div>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                Book
              </button>
            </div>
          </div>

          {/* Save row */}
          {canManage && (
            <div className="flex items-center justify-between pt-3 border-t">
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
                Reset to default
              </Button>
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="inline-flex items-center text-xs text-emerald-600">
                    <CheckIcon className="size-3 mr-1" /> Saved
                  </span>
                )}
                <Button onClick={handleSave} disabled={!isDirty || saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
