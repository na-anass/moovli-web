"use client";

import { Button } from "@/components/ui/button";
import { SaveIcon, PencilIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  /** Optional subtitle shown next to the title */
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
  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && (
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          )}
          {success && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 animate-in fade-in">
              Saved
            </Badge>
          )}
        </div>
        {/* Desktop edit button (hidden when editing — actions move to bottom bar) */}
        {canEdit && !editing && (
          <Button onClick={onEdit} className="hidden sm:flex">
            <PencilIcon className="size-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      {/* Content — scrollable area above the bottom bar */}
      <div className="flex-1 pb-24">{children}</div>

      {/* Bottom action bar — sticky, inset to avoid sidebar overlap */}
      {editing ? (
        <div className="sticky bottom-0 z-40 -mx-6 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              You have unsaved changes
            </p>
            <div className="flex items-center gap-3 ml-auto">
              <Button variant="ghost" onClick={onCancel} disabled={saving}>
                <XIcon className="size-4 mr-2" />
                Discard
              </Button>
              <Button onClick={onSave} disabled={saving}>
                <SaveIcon className="size-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : canEdit ? (
        /* Mobile-only floating edit button */
        <div className="fixed bottom-6 right-6 sm:hidden z-50">
          <Button
            onClick={onEdit}
            size="lg"
            className="rounded-full shadow-lg h-14 w-14 p-0"
          >
            <PencilIcon className="size-5" />
          </Button>
        </div>
      ) : null}
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
