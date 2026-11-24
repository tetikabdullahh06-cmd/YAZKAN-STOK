import ExcelJS from "exceljs";
import { excelDate } from "@/lib/dateFormat";

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16324F" } };
const TITLE_COLOR = { argb: "FF16324F" };
const LINE = { style: "thin", color: { argb: "FFBFCBDB" } };
const BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE };
const MAX_WIDTH = 42;

const cellValue = (column, row) => {
  const raw = row?.[column.key];
  if (column.type === "date") return excelDate(raw) || "";
  if (column.type === "number") {
    const value = Number(raw ?? 0);
    return Number.isFinite(value) ? value : 0;
  }
  return raw ?? "";
};

/**
 * Hareket Geçmişi sekmeleri için biçimlendirilmiş çalışma kitabı üretir.
 * sheets: [{ name, title, subtitle, columns: [{ header, key, type, width }], rows, footer }]
 * footer: { label, sumKeys: [] } veya sütun sayısı kadar dizi
 */
export async function buildReportWorkbook({ sheets }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "YAZKAN STOK";
  workbook.created = new Date();

  sheets.forEach((spec) => {
    const columns = spec.columns || [];
    const hasTitle = Boolean(spec.title);
    const headerRowNumber = hasTitle ? 3 : 1;
    const worksheet = workbook.addWorksheet(spec.name, {
      views: [{ state: "frozen", ySplit: headerRowNumber }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    worksheet.columns = columns.map((column) => ({
      key: column.key,
      width: Math.min(MAX_WIDTH, column.width || Math.max(12, String(column.header).length + 4)),
    }));

    if (hasTitle) {
      const lastColumn = Math.max(1, columns.length);
      worksheet.mergeCells(1, 1, 1, lastColumn);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = spec.title;
      titleCell.font = { bold: true, size: 14, color: TITLE_COLOR };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(1).height = 26;
      if (spec.subtitle) {
        worksheet.mergeCells(2, 1, 2, lastColumn);
        const subtitleCell = worksheet.getCell(2, 1);
        subtitleCell.value = spec.subtitle;
        subtitleCell.font = { italic: true, size: 10, color: { argb: "FF44546A" } };
        subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
      }
      worksheet.getRow(2).height = 18;
    }

    const headerRow = worksheet.getRow(headerRowNumber);
    columns.forEach((column, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = column.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = BORDER;
    });
    headerRow.height = 30;

    const rows = spec.rows || [];
    let hasBand = false;
    let cursor = headerRowNumber + 1;
    rows.forEach((row) => {
      if (row && row.__band) {
        hasBand = true;
        const bandRow = worksheet.getRow(cursor);
        columns.forEach((column, index) => {
          const cell = bandRow.getCell(index + 1);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
          cell.border = BORDER;
        });
        const bandCell = bandRow.getCell(1);
        bandCell.value = row.__band;
        bandCell.font = { bold: true, size: 11, color: TITLE_COLOR };
        bandCell.alignment = { horizontal: "left", vertical: "middle" };
        bandRow.height = 20;
        cursor += 1;
        return;
      }
      const excelRow = worksheet.getRow(cursor);
      columns.forEach((column, index) => {
        const cell = excelRow.getCell(index + 1);
        cell.value = cellValue(column, row);
        cell.border = BORDER;
        cell.font = { size: 10 };
        if (column.type === "date") {
          cell.numFmt = "dd/mm/yyyy";
          cell.alignment = { horizontal: "center" };
        } else if (column.type === "number") {
          cell.numFmt = "#,##0.###";
          cell.alignment = { horizontal: "right" };
        } else if (column.type === "center") {
          cell.alignment = { horizontal: "center" };
        }
        if (row.__negative) cell.font = { size: 10, color: { argb: "FF9C0006" }, bold: true };
      });
      cursor += 1;
    });

    const dataEndRow = cursor - 1;
    if (columns.length && rows.length && !hasBand) {
      worksheet.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: dataEndRow, column: columns.length },
      };
    }

    if (spec.footer && columns.length) {
      const footerRow = worksheet.getRow(dataEndRow + 1);
      const values = Array.isArray(spec.footer)
        ? spec.footer
        : columns.map((column, index) => {
            if (index === 0) return spec.footer.label || "TOPLAM";
            if ((spec.footer.sumKeys || []).includes(column.key)) {
              const total = (spec.rows || []).reduce((sum, row) => sum + Number(row?.[column.key] || 0), 0);
              return Math.round(total * 1000) / 1000;
            }
            return "";
          });
      values.forEach((value, index) => {
        const cell = footerRow.getCell(index + 1);
        cell.value = value;
        cell.font = { bold: true, size: 10, color: TITLE_COLOR };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
        cell.border = BORDER;
        const column = columns[index];
        if (column?.type === "number") {
          cell.numFmt = "#,##0.###";
          cell.alignment = { horizontal: "right" };
        }
      });
    }
  });

  return workbook;
}

export async function downloadReportWorkbook({ filename, sheets }) {
  const workbook = await buildReportWorkbook({ sheets });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
