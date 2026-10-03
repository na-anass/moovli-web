// ============================================================================
// Export the Statistiques page as CSV or Excel
// ----------------------------------------------------------------------------
// Both formats are built in the browser from data the page already loaded, so
// an export is instant and needs no endpoint. The shared shape is a list of
// SHEETS; CSV writes them as labelled blocks in one file, Excel as one tab each.
//
// Excel support comes from `exceljs`, imported dynamically so its ~1 MB only
// loads for someone who actually exports.
// ============================================================================

export interface ExportSheet {
  /** Tab name in Excel, block heading in CSV. */
  name: string;
  columns: string[];
  rows: (string | number)[][];
}

const sanitizeFilename = (value: string) =>
  value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").toLowerCase();

export const insightsFilename = (studioSlug: string, from: string, to: string) =>
  `moovli-statistiques-${sanitizeFilename(studioSlug || "studio")}-${from}_${to}`;

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** RFC 4180: quote anything containing a delimiter, quote or newline. */
const csvCell = (value: string | number): string => {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const exportSheetsAsCsv = (sheets: ExportSheet[], filename: string) => {
  const body = sheets
    .map((sheet) =>
      [
        `# ${sheet.name}`,
        sheet.columns.map(csvCell).join(","),
        ...sheet.rows.map((row) => row.map(csvCell).join(",")),
      ].join("\n"),
    )
    .join("\n\n");

  // The BOM is what makes Excel read accents correctly on a double-click.
  const blob = new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
};

export const exportSheetsAsXlsx = async (sheets: ExportSheet[], filename: string) => {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Moovli";
  workbook.created = new Date();

  for (const sheet of sheets) {
    // Excel rejects tab names over 31 chars or containing []:*?/\
    const worksheet = workbook.addWorksheet(sheet.name.replace(/[[\]:*?/\\]/g, "").slice(0, 31));
    worksheet.addRow(sheet.columns);
    worksheet.getRow(1).font = { bold: true };
    for (const row of sheet.rows) worksheet.addRow(row);

    worksheet.columns.forEach((column, i) => {
      const longest = Math.max(
        sheet.columns[i]?.length ?? 0,
        ...sheet.rows.map((row) => String(row[i] ?? "").length),
      );
      column.width = Math.min(42, Math.max(12, longest + 2));
    });
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filename}.xlsx`,
  );
};
