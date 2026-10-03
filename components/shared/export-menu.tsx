"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportSheetsAsCsv,
  exportSheetsAsXlsx,
  type ExportSheet,
} from "@/lib/export/insights-export";

/**
 * "Export ▾" with CSV and Excel.
 *
 * `build` is called on click rather than on render, so the sheets are only
 * assembled when someone actually exports — and always from the data on screen
 * at that moment.
 */
export function ExportMenu({
  build,
  filename,
  disabled,
}: {
  build: () => ExportSheet[];
  filename: string;
  disabled?: boolean;
}) {
  const t = useTranslations("shared.export");
  const [busy, setBusy] = useState(false);

  const run = async (format: "csv" | "xlsx") => {
    setBusy(true);
    try {
      const sheets = build();
      if (format === "csv") exportSheetsAsCsv(sheets, filename);
      else await exportSheetsAsXlsx(sheets, filename);
    } catch (error) {
      // Nothing to recover from — the download just didn't start.
      console.error("Export failed:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || busy}>
          <DownloadIcon className="size-4" />
          {busy ? t("working") : t("label")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run("csv")}>
          <FileTextIcon className="size-4" />
          {t("csv")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("xlsx")}>
          <FileSpreadsheetIcon className="size-4" />
          {t("excel")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
