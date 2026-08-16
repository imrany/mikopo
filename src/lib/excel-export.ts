import * as XLSX from "xlsx";

interface ExportOptions {
  fileName?: string;
  sheetName?: string;
}

/**
 * Utility function to calculate reasonable column widths based on cell content
 */
function autoFitColumnWidths(data: Record<string, any>[]): { wch: number }[] {
  if (!data || data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const colWidths: { [key: string]: number } = {};

  // Set initial width based on header length
  headers.forEach((header) => {
    colWidths[header] = Math.max(header.length, 10);
  });

  // Measure content lengths
  data.forEach((row) => {
    headers.forEach((header) => {
      const val = row[header];
      const strVal = val !== null && val !== undefined ? String(val) : "";
      colWidths[header] = Math.max(colWidths[header], Math.min(strVal.length, 50));
    });
  });

  return headers.map((header) => ({ wch: colWidths[header] + 3 }));
}

/**
 * Export a single JSON dataset array to an Excel (.xlsx) file
 */
export function downloadExcelFromData(data: Record<string, any>[], options: ExportOptions = {}) {
  if (!data || data.length === 0) {
    throw new Error("No data available to export.");
  }

  const { fileName = "Platform_Export", sheetName = "Data" } = options;

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto column widths
  worksheet["!cols"] = autoFitColumnWidths(data);

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

  const cleanFileName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, cleanFileName);
}

/**
 * Export multiple datasets into a multi-sheet Excel (.xlsx) workbook
 */
export function downloadMultiSheetExcel(
  sheets: { sheetName: string; data: Record<string, any>[] }[],
  fileName = "Platform_Full_Backup",
) {
  const workbook = XLSX.utils.book_new();
  let addedSheetsCount = 0;

  sheets.forEach(({ sheetName, data }) => {
    if (data && data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet["!cols"] = autoFitColumnWidths(data);
      const safeSheetName = sheetName.substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
      addedSheetsCount++;
    }
  });

  if (addedSheetsCount === 0) {
    throw new Error("No data available across any category to export.");
  }

  const cleanFileName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, cleanFileName);
}
