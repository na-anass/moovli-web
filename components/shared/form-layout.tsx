"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEditMode } from "@/components/layout/topbar";

interface FormLayoutProps {
  title: string;
  children: React.ReactNode;
  editing: boolean;
  canEdit: boolean;
  saving: boolean;
  success: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  subtitle?: string;
}

export function FormLayout({
  title,
  children,
  editing,
  canEdit,
  saving,
  success,
  onEdit,
  onSave,
  onCancel,
  subtitle,
}: FormLayoutProps) {
  const { setEditMode } = useEditMode();

  // Sync edit state to the top bar
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && (
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          )}
          {success && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Saved
            </Badge>
          )}
        </div>
        {canEdit && !editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="hidden sm:flex gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <PencilIcon className="size-3.5" />
            Edit
          </Button>
        )}
      </div>

      {/* Content */}
      <div>{children}</div>

      {/* Mobile-only floating edit button */}
      {!editing && canEdit && (
        <div className="fixed bottom-6 right-6 sm:hidden z-50">
          <Button
            onClick={onEdit}
            size="lg"
            className="rounded-full shadow-lg h-14 w-14 p-0"
          >
            <PencilIcon className="size-5" />
          </Button>
        </div>
      )}
    </div>
  );
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
