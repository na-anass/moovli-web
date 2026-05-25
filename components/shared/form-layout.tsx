"use client";

import { useEffect } from "react";
import { useEditMode } from "@/components/layout/topbar";

/**
 * Pushes form edit state to the top-bar sticky save bar.
 *
 * Pages should render their chrome via BaseLayout and use this hook to wire
 * the top-bar save bar. The header Edit/Save buttons live in BaseLayout's
 * `action` slot.
 */
export function useEditModeSync({
  editing,
  saving,
  title,
  onSave,
  onCancel,
}: {
  editing: boolean;
  saving: boolean;
  title: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { setEditMode } = useEditMode();

  useEffect(() => {
    if (editing) {
      setEditMode({
        editing: true,
        saving,
        title: `Editing ${title}`,
        onSave,
        onCancel,
      });
    } else {
      setEditMode(null);
    }
    return () => setEditMode(null);
  }, [editing, saving, title, onSave, onCancel, setEditMode]);
}

/** Reusable section card for grouping form fields */
export function FormSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

/** Reusable field that switches between view and edit mode */
export function FormField({
  label,
  icon,
  editing,
  value,
  formValue,
  onChange,
  span,
  type = "text",
  placeholder,
  multiline,
}: {
  label: string;
  icon?: React.ReactNode;
  editing: boolean;
  value: string | null;
  formValue: string;
  onChange: (v: string) => void;
  span?: number;
  type?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className={span === 2 ? "md:col-span-2" : ""}>
      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </label>
      {editing ? (
        multiline ? (
          <textarea
            className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            value={formValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <input
            type={type}
            className="mt-1.5 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={formValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        )
      ) : (
        <p className="mt-1.5 text-foreground text-sm">
          {value || (
            <span className="text-muted-foreground italic">Not set</span>
          )}
        </p>
      )}
    </div>
  );
}
