import ExcelJS from "exceljs";
import { CARD_DEFAULTS, cardDate, detailRows } from "./recipeCardData";

const clone = (value) => JSON.parse(JSON.stringify(value));
const PAGE_LINES = 28;
const FIRST_LINE_ROW = 6;
const FOOTER_ROW = FIRST_LINE_ROW + PAGE_LINES;

export async function buildRecipeCardWorkbook(templateBytes, recipe, groups) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes);
  const source = wb.worksheets[0];
  const baseModel = clone(source.model);
  // ExcelJS exports `merges`, but its model setter restores `mergeCells`.
  baseModel.mergeCells = baseModel.merges;
  const originalTechnicalWidths = [12, 13, 14, 15].map((col) => source.getColumn(col).width);
  const bodyStyles = Array.from({ length: 17 }, (_, i) => clone(source.getCell(FIRST_LINE_ROW, Math.min(i + 1, 15)).style));
  const footer = [20, 21, 22].map((row) => ({
    height: source.getRow(row).height,
    cells: Array.from({ length: 17 }, (_, i) => ({ value: source.getCell(row, i + 1).value, style: clone(source.getCell(row, i + 1).style) })),
  }));
  const pages = Math.max(1, Math.ceil(groups.length / PAGE_LINES));
  for (let page = 0; page < pages; page++) {
    const ws = page === 0 ? source : wb.addWorksheet(`Takım Kartı ${page + 1}`);
    if (page > 0) { ws.model = clone(baseModel); }
    ws.name = pages === 1 ? "Takım Kartı" : `Takım Kartı ${page + 1}`;
    for (const [previous, expanded] of [["M1:O1", "M1:Q1"], ["D2:O2", "D2:Q2"], ["H3:O3", "H3:Q3"]]) {
      ws.unMergeCells(previous); ws.mergeCells(expanded);
      const master = ws.getCell(expanded.split(":")[0]);
      master.border = { ...master.border, right: { style: "medium", color: { argb: "FF000000" } } };
    }
    ws.mergeCells("P4:P5");
    ws.getColumn(16).width = 13;
    ws.getCell("P4").style = clone(ws.getCell("O4").style);
    ws.getCell("P4").value = "ÖZEL";
    ws.mergeCells("Q4:Q5");
    ws.getColumn(17).width = 13;
    ws.getCell("Q4").style = clone(ws.getCell("O4").style);
    ws.getCell("Q4").value = "TAKIM TAM BOY\n(mm)";
    ws.getCell("Q4").note = "ZOLLER TAM BOY ÖLÇÜSÜNÜ GİRİNİZ.";
    ws.getColumn(12).width = 13;
    originalTechnicalWidths.forEach((width, index) => { ws.getColumn(13 + index).width = width; });
    ws.pageSetup = { ...ws.pageSetup, orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, printArea: `A1:Q${FOOTER_ROW + 2}` };
    ws.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 };
    ws.views = [{ showGridLines: false }];
    ws.unMergeCells("A20:B20");
    ws.unMergeCells("A21:B21");
    for (let row = FIRST_LINE_ROW; row < FOOTER_ROW; row++) {
      for (let col = 1; col <= 17; col++) {
        const cell = ws.getCell(row, col);
        cell.style = clone(bodyStyles[col - 1]);
        cell.value = null;
      }
      ws.getRow(row).height = 28;
    }
    footer.forEach((saved, index) => {
      const row = FOOTER_ROW + index;
      ws.getRow(row).height = saved.height;
      saved.cells.forEach((savedCell, col) => {
        const cell = ws.getCell(row, col + 1);
        cell.value = savedCell.value;
        cell.style = clone(savedCell.style);
      });
    });
    ws.mergeCells(`A${FOOTER_ROW}:B${FOOTER_ROW}`);
    ws.mergeCells(`A${FOOTER_ROW + 1}:B${FOOTER_ROW + 1}`);
    // Only merged MASTER cells are written; children would erase their headings.
    ws.getCell("D2").value = recipe.workpiece_name || "";
    ws.getCell("G3").value = recipe.machine_code || "";
    ws.getCell("H3").value = recipe.machine_type || "";
    ws.getCell("C4").value = `OPERASYON ${recipe.operation_no ?? CARD_DEFAULTS.operation_no}`;
    ws.getCell("L4").value = "KESME HIZI\n(m/dk)";
    ws.getCell("M4").value = "DEVİR\n(dev/dk)";
    ws.getCell("N4").value = "İLERLEME\n(mm/dk)";
    ws.getCell("O4").value = "TAKIM ÖMRÜ\n(ADET)";
    ws.getCell("K4").value = "İNSERT\nKALİTESİ";
    ws.getCell("J4").value = "KULLANILAN İNSERT";
    for (const address of ["B4", "C4", "D4", "F4", "H4", "I4", "J4", "K4", "L4", "M4", "N4", "O4", "P4", "Q4", "A5", "C5", "D5", "E5", "F5", "G5"]) {
      ws.getCell(address).font = { name: "Arial", size: 9, bold: true };
      ws.getCell(address).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    ws.getCell("M1").value = `Doküman No: ${recipe.document_no ?? CARD_DEFAULTS.document_no}\nYayın Tarihi: ${cardDate(recipe.publication_date ?? CARD_DEFAULTS.publication_date)}\nRevizyon No: ${recipe.revision_no ?? CARD_DEFAULTS.revision_no}\nRevizyon Tarihi: ${cardDate(recipe.revision_date)}`;
    ws.getCell("M1").font = { ...ws.getCell("M1").font, size: 9 };
    ws.getCell("M1").alignment = { vertical: "middle", wrapText: true };
    ws.getCell(FOOTER_ROW + 1, 1).value = recipe.prepared_by || "";
    ws.getCell(FOOTER_ROW + 1, 3).value = recipe.approved_by || "";
    ws.getCell(FOOTER_ROW + 2, 1).value = "F-165 / R.02 / 15.11.2019";
    if (pages > 1) ws.getCell(FOOTER_ROW + 2, 8).value = `Sayfa ${page + 1} / ${pages}`;
    groups.slice(page * PAGE_LINES, (page + 1) * PAGE_LINES).forEach((group, index) => {
      const p = group.product || {}, h = group.holder || {};
      const values = [p.tool_no || page * PAGE_LINES + index + 1, p.brand || "", p.name || "", p.inner_cooling === "VAR" ? "X" : "", p.inner_cooling === "YOK" ? "X" : "", p.holder_type || h.name || "", p.holder_length || "", p.drill_helix_length || "", p.insert_brand || "", p.used_insert || "", p.insert_quality || "", p.cutting_speed || "", p.spindle_speed || "", p.feed_rate || "", p.tool_life || "", p.special || "", p.tool_total_length || ""];
      values.forEach((value, c) => { const cell = ws.getCell(FIRST_LINE_ROW + index, c + 1); cell.value = value; cell.font = { name: "Arial", size: 9 }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });
    });
  }
  // Preserve all legacy values; Zoller total length and cutting speed extend the original form.
  const detail = wb.addWorksheet("Reçete Verileri");
  const rows = detailRows(recipe, groups);
  const headers = Object.keys(rows[0] || detailRows(recipe, [{ product: {} }])[0]);
  detail.addRow(headers);
  detail.getCell(1, headers.indexOf("Takım Tam Boy (mm)") + 1).note = "ZOLLER TAM BOY ÖLÇÜSÜNÜ GİRİNİZ.";
  rows.forEach((row) => {
    const excelRow = detail.addRow(headers.map((key) => {
      if ((key === "Yayın Tarihi" || key === "Revizyon Tarihi") && row[key]) return new Date(`${row[key]}T00:00:00Z`);
      return row[key];
    }));
    headers.forEach((key, i) => { if (key === "Yayın Tarihi" || key === "Revizyon Tarihi") excelRow.getCell(i + 1).numFmt = "dd/mm/yy"; });
  });
  detail.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  detail.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17365D" } };
  detail.getRow(1).height = 30;
  detail.columns.forEach((column) => { column.width = 22; });
  detail.views = [{ state: "frozen", ySplit: 1 }];
  detail.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
  detail.pageSetup = { orientation: "landscape", paperSize: 8, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
  return wb;
}
