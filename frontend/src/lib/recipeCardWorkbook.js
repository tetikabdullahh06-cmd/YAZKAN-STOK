import ExcelJS from "exceljs";
import { CARD_DEFAULTS, cardDate, detailRows } from "./recipeCardData";

const clone = (value) => JSON.parse(JSON.stringify(value));
const PAGE_LINES = 14;

export async function buildRecipeCardWorkbook(templateBytes, recipe, groups) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes);
  const source = wb.worksheets[0];
  const baseModel = clone(source.model);
  const pages = Math.max(1, Math.ceil(groups.length / PAGE_LINES));
  for (let page = 0; page < pages; page++) {
    const ws = page === 0 ? source : wb.addWorksheet(`Takım Kartı ${page + 1}`);
    if (page > 0) { ws.model = clone(baseModel); }
    ws.name = pages === 1 ? "Takım Kartı" : `Takım Kartı ${page + 1}`;
    ws.pageSetup = { ...ws.pageSetup, orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, printArea: "A1:O22" };
    ws.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 };
    ws.views = [{ showGridLines: false }];
    for (let row = 6; row <= 19; row++) {
      for (let col = 1; col <= 15; col++) ws.getCell(row, col).value = null;
      ws.getRow(row).height = 25;
    }
    // Only merged MASTER cells are written; children would erase their headings.
    ws.getCell("D2").value = recipe.workpiece_name || "";
    ws.getCell("G3").value = recipe.machine_code || "";
    ws.getCell("H3").value = recipe.machine_type || "";
    ws.getCell("C4").value = `OPERASYON ${recipe.operation_no ?? CARD_DEFAULTS.operation_no}`;
    ws.getCell("L4").value = "DEVİR\n(dev/dk)";
    ws.getCell("M4").value = "İLERLEME\n(mm/dk)";
    ws.getCell("K4").value = "İNSERT\nKALİTESİ";
    ws.getCell("J4").value = "KULLANILAN İNSERT";
    for (const address of ["B4", "C4", "D4", "F4", "H4", "I4", "J4", "K4", "L4", "M4", "N4", "O4", "A5", "C5", "D5", "E5", "F5", "G5"]) {
      ws.getCell(address).font = { name: "Arial", size: 9, bold: true };
      ws.getCell(address).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    ws.getCell("M1").value = `Doküman No: ${recipe.document_no ?? CARD_DEFAULTS.document_no}\nYayın Tarihi: ${cardDate(recipe.publication_date ?? CARD_DEFAULTS.publication_date)}\nRevizyon No: ${recipe.revision_no ?? CARD_DEFAULTS.revision_no}\nRevizyon Tarihi: ${cardDate(recipe.revision_date)}`;
    ws.getCell("M1").font = { ...ws.getCell("M1").font, size: 9 };
    ws.getCell("M1").alignment = { vertical: "middle", wrapText: true };
    ws.getCell("A21").value = recipe.prepared_by || "";
    ws.getCell("C21").value = recipe.approved_by || "";
    ws.getCell("A22").value = "F-165 / R.02 / 15.11.2019";
    if (pages > 1) ws.getCell("H22").value = `Sayfa ${page + 1} / ${pages}`;
    groups.slice(page * PAGE_LINES, (page + 1) * PAGE_LINES).forEach((group, index) => {
      const p = group.product || {}, h = group.holder || {};
      const values = [p.tool_no || page * PAGE_LINES + index + 1, p.brand || "", p.name || "", p.inner_cooling === "VAR" ? "X" : "", p.inner_cooling === "YOK" ? "X" : "", p.holder_type || h.name || "", p.holder_length || "", p.drill_helix_length || "", p.insert_brand || "", p.used_insert || "", p.insert_quality || "", p.spindle_speed || "", p.feed_rate || "", p.tool_life || "", p.special || ""];
      values.forEach((value, c) => { const cell = ws.getCell(6 + index, c + 1); cell.value = value; cell.font = { name: "Arial", size: 9 }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });
    });
  }
  // Preserve every legacy and new value without changing the original 15-column form.
  const detail = wb.addWorksheet("Reçete Verileri");
  const rows = detailRows(recipe, groups);
  const headers = Object.keys(rows[0] || detailRows(recipe, [{ product: {} }])[0]);
  detail.addRow(headers);
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
