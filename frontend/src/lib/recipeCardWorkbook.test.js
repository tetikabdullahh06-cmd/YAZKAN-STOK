/** @jest-environment node */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { buildRecipeCardWorkbook } from "./recipeCardWorkbook";
import { CARD_DEFAULTS, matchStock, groupRecipeLines, detailRows, parseDetailRows, dateISO, cardDate, parseCardMatrix } from "./recipeCardData";

const template = fs.readFileSync(path.join(__dirname, "../templates/F-165-original.xlsx"));
const p = { kind: "product", reference_id: "p1", pair_id: "pair1", code: "YZK-01", name: "Ø20 KARBÜR FREZE", brand: "GÜHRİNG", quantity: 2, tool_no: "T07", machining_length: "32 mm", tool_total_length: "185,25", cutting_speed: "65 m/dk", spindle_speed: "1035 dev/dk", feed_rate: "124 mm/dk", inner_cooling: "YOK", holder_type: "HİDROLİK", holder_length: "STANDART", drill_helix_length: "45 mm", insert_brand: "ZCC-CT", used_insert: "TCMT110404", insert_quality: "P25", tool_life: "120", special: "Kaba işleme" };
const h = { kind: "toolholder", reference_id: "h1", pair_id: "pair1", code: "H-01", name: "Hidrolik Tutucu", brand: "AKKO", quantity: 1 };
const recipe = { ...CARD_DEFAULTS, name: "TEST — örnek reçete", workpiece_name: "ÖRNEK PARÇA", machine_code: "DİK-01", machine_type: "CNC DİK İŞLEM", revision_date: "2026-11-18", prepared_by: "Örnek hazırlayan", approved_by: "Örnek onaylayan", note: "Yalnızca test verisi", lines: [p, h] };
const shiftedFields = ["insert_quality", "cutting_speed", "spindle_speed", "feed_rate", "tool_life", "special", "tool_total_length"];
const PAGE_LINES = 28;

const printedValues = (group, index) => {
  const product = group.product || {}, holder = group.holder || {};
  return [product.tool_no || index + 1, product.brand || "", product.name || "", product.inner_cooling === "VAR" ? "X" : "", product.inner_cooling === "YOK" ? "X" : "", product.holder_type || holder.name || "", product.holder_length || "", product.drill_helix_length || "", product.insert_brand || "", product.used_insert || "", product.insert_quality || "", product.cutting_speed || "", product.spindle_speed || "", product.feed_rate || "", product.tool_life || "", product.special || "", product.tool_total_length || ""];
};

const numberedGroups = (count, explicitNumbers = false) => Array.from({ length: count }, (_, i) => ({
  product: { ...p, code: `YZK-${i + 1}`, name: `Takım ${i + 1}`, tool_no: explicitNumbers ? String(i + 1) : "", quantity: i + 1, machining_length: `${i + 1} mm`, inner_cooling: i % 2 ? "VAR" : "YOK", insert_quality: `P${i + 1}`, cutting_speed: `${i + 1} m/dk`, spindle_speed: `${1000 + i} dev/dk`, feed_rate: `${100 + i} mm/dk`, tool_life: String(120 + i), special: `Özel ${i + 1}`, tool_total_length: `${185 + i},25` },
  holder: { ...h, quantity: i + 1 },
}));

function expectPrintedCard(wb, ws, cardRecipe, page, pages) {
  expect(ws.getCell("C1").value).toBeTruthy();
  expect(ws.getCell("B4").value).toBe("TAKIM MARKASI");
  expect(ws.getCell("Q4").value).toBe("TAKIM TAM BOY\n(mm)");
  expect(ws.getCell("L4").value).toBe("KESME HIZI\n(m/dk)");
  expect(ws.getCell("L5").master.address).toBe("L4");
  expect(ws.getCell("Q5").master.address).toBe("Q4");
  expect(JSON.stringify(ws.getCell("Q4").note)).toContain("ZOLLER TAM BOY ÖLÇÜSÜNÜ GİRİNİZ.");
  expect(ws.model.merges).toEqual(expect.arrayContaining(["A1:B1", "C1:L1", "M1:Q1", "D2:Q2", "H3:Q3", "L4:L5", "Q4:Q5", "A34:B34", "A35:B35"]));
  expect(ws.getCell("B34").master.address).toBe("A34");
  expect(ws.getCell("B35").master.address).toBe("A35");
  expect(ws.getCell("A34").value).toBe("HAZIRLAYAN");
  expect(ws.getCell("C34").value).toBe("ONAYLAYAN");
  expect(ws.getCell("A35").value).toBe(cardRecipe.prepared_by || "");
  expect(ws.getCell("C35").value).toBe(cardRecipe.approved_by || "");
  expect(ws.getCell("A36").value).toBe("F-165 / R.02 / 15.11.2019");
  if (pages > 1) expect(ws.getCell("H36").value).toBe(`Sayfa ${page} / ${pages}`);
  expect(ws.pageSetup).toMatchObject({ orientation: "landscape", paperSize: 9, printArea: "A1:Q36", fitToPage: true, fitToWidth: 1, fitToHeight: 1 });
  expect(ws.columnCount).toBe(17);
  for (let row = 6; row <= 33; row++) expect(ws.getRow(row).height).toBe(28);
  expect(ws.getImages()).toHaveLength(1);
  const logo = ws.getImages()[0];
  expect(logo.range.tl.row).toBeLessThan(1);
  expect(logo.range.br.row).toBeLessThanOrEqual(1);
  expect(wb.getImage(logo.imageId).buffer.length).toBeGreaterThan(0);
  expect(ws.getCell("D2").value).toBe(cardRecipe.workpiece_name || "");
  expect(ws.getCell("G3").value).toBe(cardRecipe.machine_code || "");
  expect(ws.getCell("H3").value).toBe(cardRecipe.machine_type || "");
}

function expectAllGroups(wb, groups, cardRecipe) {
  const pages = Math.max(1, Math.ceil(groups.length / PAGE_LINES));
  const names = [];
  expect(wb.worksheets).toHaveLength(pages + 1);
  for (let page = 0; page < pages; page++) {
    const ws = wb.getWorksheet(pages === 1 ? "Takım Kartı" : `Takım Kartı ${page + 1}`);
    expectPrintedCard(wb, ws, cardRecipe, page + 1, pages);
    for (let slot = 0; slot < PAGE_LINES; slot++) {
      const index = page * PAGE_LINES + slot;
      const values = Array.from({ length: 17 }, (_, col) => ws.getCell(slot + 6, col + 1).value);
      if (index < groups.length) {
        expect(values).toEqual(printedValues(groups[index], index));
        names.push(ws.getCell(slot + 6, 3).value);
      } else {
        expect(values).toEqual(Array(17).fill(null));
      }
    }
  }
  expect(names).toEqual(groups.map((group) => group.product.name));
  const detail = wb.getWorksheet("Reçete Verileri");
  expect(detail.rowCount).toBe(groups.length + 1);
  const headers = detail.getRow(1).values.slice(1);
  detailRows(cardRecipe, groups).forEach((record, index) => {
    const expected = headers.map((key) => record[key]);
    const actual = headers.map((key, col) => {
      const value = detail.getCell(index + 2, col + 1).value;
      return value instanceof Date ? value.toISOString().slice(0, 10) : value;
    });
    expect(actual).toEqual(expected);
  });
}

it("preserves the original F-165 merged headings, logo, footer and all filled values", async () => {
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: p, holder: h }]);
  const buffer = await wb.xlsx.writeBuffer(); const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(buffer);
  const ws = loaded.getWorksheet("Takım Kartı");
  for (const address of ["C1", "B4", "D4", "F4", "H4", "I4", "J4", "K4", "L4", "M4", "N4", "O4"]) expect(ws.getCell(address).value).toBeTruthy();
  expect(ws.getCell("A5").value).toBe("TAKIM NO:");
  expect(ws.getCell("M1").value).toContain("09/05/25"); expect(ws.getCell("M1").value).toContain("18/11/26");
  expect(ws.getCell("D2").value).toBe(recipe.workpiece_name); expect(ws.getCell("G3").value).toBe(recipe.machine_code); expect(ws.getCell("H3").value).toBe(recipe.machine_type);
  expect(ws.getCell("Q4").value).toBe("TAKIM TAM BOY\n(mm)"); expect(ws.getCell("Q6").value).toBe("185,25");
  expect(JSON.stringify(ws.getCell("Q4").note)).toContain("ZOLLER TAM BOY ÖLÇÜSÜNÜ GİRİNİZ.");
  expect(ws.getCell("L4").value).toBe("KESME HIZI\n(m/dk)"); expect(ws.getCell("L5").master.address).toBe("L4");
  expect(ws.getCell("L6").value).toBe(p.cutting_speed); expect(ws.pageSetup.printArea).toBe("A1:Q36");
  expect(ws.getCell("A6").value).toBe("T07"); expect(ws.getCell("B6").value).toBe(p.brand); expect(ws.getCell("J6").value).toBe(p.used_insert);
  expect(ws.getCell("M6").value).toBe(p.spindle_speed); expect(ws.getCell("N6").value).toBe(p.feed_rate);
  expect(ws.getCell("A34").value).toBe("HAZIRLAYAN"); expect(ws.getCell("A35").value).toBe(recipe.prepared_by); expect(ws.getCell("C35").value).toBe(recipe.approved_by); expect(ws.getCell("A36").value).toBe("F-165 / R.02 / 15.11.2019");
  expectAllGroups(loaded, [{ product: p, holder: h }], recipe);
  const detail = loaded.getWorksheet("Reçete Verileri"); expect(detail.getCell("E2").numFmt).toBe("dd/mm/yy");
});

it("prints K:Q in insert quality, cutting speed, spindle speed, feed, life, special and Zoller length order", async () => {
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: p, holder: h }]);
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await wb.xlsx.writeBuffer());
  const ws = loaded.getWorksheet("Takım Kartı");
  const columns = ["K", "L", "M", "N", "O", "P", "Q"];
  expect(columns.map((column) => String(ws.getCell(`${column}4`).value).replace(/\s+/g, " ").trim())).toEqual([
    "İNSERT KALİTESİ", "KESME HIZI (m/dk)", "DEVİR (dev/dk)", "İLERLEME (mm/dk)", "TAKIM ÖMRÜ (ADET)", "ÖZEL", "TAKIM TAM BOY (mm)",
  ]);
  expect(columns.map((column) => ws.getCell(`${column}6`).value)).toEqual(shiftedFields.map((key) => p[key]));
  expect(ws.columnCount).toBe(17); expect(ws.pageSetup.printArea).toBe("A1:Q36");
  expect(ws.getCell("Q5").master.address).toBe("Q4");
  expect(JSON.stringify(ws.getCell("Q4").note)).toContain("ZOLLER TAM BOY ÖLÇÜSÜNÜ GİRİNİZ.");
});

it("paginates 29 tools into two 28-slot cards plus details without losing values, footers or logos", async () => {
  const groups = numberedGroups(29, true);
  const wb = await buildRecipeCardWorkbook(template, recipe, groups);
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await wb.xlsx.writeBuffer());
  expect(loaded.worksheets).toHaveLength(3);
  expectAllGroups(loaded, groups, recipe);
  expect(loaded.getWorksheet("Takım Kartı 1").getCell("C33").value).toBe("Takım 28");
  expect(loaded.getWorksheet("Takım Kartı 1").getCell("A33").value).toBe("28");
  expect(loaded.getWorksheet("Takım Kartı 2").getCell("C6").value).toBe("Takım 29");
  expect(loaded.getWorksheet("Takım Kartı 2").getCell("A6").value).toBe("29");
  expect(loaded.getWorksheet("Reçete Verileri").rowCount).toBe(30);
});

it.each([[0, 1], [28, 1], [56, 2], [57, 3]])("prints %i tools on %i cards with continuous automatic numbers and complete details", async (count, pages) => {
  const groups = numberedGroups(count);
  const wb = await buildRecipeCardWorkbook(template, recipe, groups);
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await wb.xlsx.writeBuffer());
  expect(loaded.worksheets).toHaveLength(pages + 1);
  expectAllGroups(loaded, groups, recipe);
  if (count) {
    const last = loaded.getWorksheet(pages === 1 ? "Takım Kartı" : `Takım Kartı ${pages}`);
    const row = ((count - 1) % PAGE_LINES) + 6;
    expect(last.getCell(row, 1).value).toBe(count);
    expect(last.getCell(row, 3).value).toBe(`Takım ${count}`);
  }
});

it("round-trips all new and legacy parameters and quantities through exported Excel", async () => {
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: p, holder: h }]);
  const book = XLSX.read(await wb.xlsx.writeBuffer(), { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(book.Sheets["Reçete Verileri"], { raw: false, defval: "" });
  const result = parseDetailRows(rows, [{ id: "p1", code: p.code, name: p.name, brand: p.brand }], [{ id: "h1", code: h.code, name: h.name, brand: h.brand }]);
  expect(result.warnings).toEqual([]); expect(result.groups).toHaveLength(1);
  for (const key of ["machining_length", "tool_total_length", "cutting_speed", "spindle_speed", "feed_rate", "tool_no", "inner_cooling", "holder_type", "holder_length", "drill_helix_length", "insert_brand", "used_insert", "insert_quality", "tool_life", "special", "quantity"]) expect(result.groups[0].product[key]).toBe(p[key]);
  expect(result.groups[0].holder.quantity).toBe(1); expect(result.card.revision_date).toBe("2026-11-18"); expect(result.card.publication_date).toBe("2025-05-09"); expect(result.card.revision_no).toBe("00");
});

it("never matches by brand alone, empty code, partial or ambiguous name", () => {
  const products = [{ id: "a", name: "Ø20 FREZE", brand: "A", code: "" }, { id: "b", name: "Ø20 FREZE", brand: "B", code: "" }];
  expect(matchStock(products, { code: "", name: "not found", brand: "A" })).toBeNull();
  expect(matchStock(products, { name: "Ø20" })).toBeNull(); expect(matchStock(products, { name: "Ø20 FREZE" })).toBeNull();
  expect(matchStock(products, { name: "Ø20 FREZE", brand: "B" }).id).toBe("b");
});

it("preserves legacy adjacent product/holder pairing and optional holder", () => {
  expect(groupRecipeLines([{ ...p, pair_id: "" }, { ...h, pair_id: "" }, { ...p, pair_id: "" }])).toHaveLength(2);
  expect(groupRecipeLines([{ ...p, pair_id: "" }, { ...h, pair_id: "" }])[0].holder.reference_id).toBe("h1");
});

it("parses original F-165 safely and leaves unmatched tools out with warnings", () => {
  const book = XLSX.read(template, { type: "buffer" }); const matrix = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: "", raw: false });
  const result = parseCardMatrix(matrix, [{ id: "one", name: "Ø55 ADİK", brand: "TEKNİK", code: "P1", cutting_speed: "77 m/dk" }], []);
  expect(result.groups).toHaveLength(1); expect(result.warnings).toHaveLength(13); expect(result.groups.length + result.warnings.length).toBe(14); expect(result.groups[0].product.spindle_speed).toBe("450"); expect(result.groups[0].holder).toBeNull(); expect(result.card.publication_date).toBe("2025-05-09");
  expect(result.groups[0].product.cutting_speed).toBe("77 m/dk");
});

it("supports GG/AA/YY input and canonical ISO persistence", () => {
  expect(dateISO("18/11/26")).toBe("2026-11-18"); expect(cardDate("09.05.2025")).toBe("09/05/25");
});

it("creates a completely blank reusable 28-slot template without overwriting prior deliveries", async () => {
  const blank = await buildRecipeCardWorkbook(template, CARD_DEFAULTS, []);
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await blank.xlsx.writeBuffer());
  expectAllGroups(loaded, [], CARD_DEFAULTS);
  for (let row = 6; row <= 33; row++) for (let col = 1; col <= 17; col++) expect(loaded.worksheets[0].getCell(row, col).value).toBeNull();
});

it("imports all seven shifted fields from the standalone printed card instead of differing stock values", async () => {
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: p, holder: h }]);
  wb.removeWorksheet(wb.getWorksheet("Reçete Verileri").id);
  const book = XLSX.read(await wb.xlsx.writeBuffer(), { type: "buffer" });
  expect(book.SheetNames).toEqual(["Takım Kartı"]);
  const matrix = XLSX.utils.sheet_to_json(book.Sheets["Takım Kartı"], { header: 1, defval: "", raw: false });
  const stock = { id: "p1", name: p.name, code: p.code, brand: p.brand, ...Object.fromEntries(shiftedFields.map((key) => [key, `stock ${key}`])) };
  const result = parseCardMatrix(matrix, [stock], []);
  expect(result.warnings).toEqual([]); expect(result.groups).toHaveLength(1);
  for (const key of shiftedFields) expect(result.groups[0].product[key]).toBe(p[key]);
});

it("imports the previous K quality, L spindle, M feed, N life, O special, P length and Q cutting-speed layout", async () => {
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: p, holder: h }]);
  wb.removeWorksheet(wb.getWorksheet("Reçete Verileri").id);
  const book = XLSX.read(await wb.xlsx.writeBuffer(), { type: "buffer" });
  const matrix = XLSX.utils.sheet_to_json(book.Sheets["Takım Kartı"], { header: 1, defval: "", raw: false });
  const metaRows = matrix.slice(0, 3).map((row) => [...row]);
  const footerRows = matrix.slice(33).map((row) => [...row]);
  // Reorder only the two header rows and all 28 body rows, never M1 metadata or row 34+ footers.
  matrix.slice(3, 33).forEach((row) => {
    const shifted = row.slice(11, 17);
    [1, 2, 3, 4, 5, 0].forEach((source, index) => { row[11 + index] = shifted[source]; });
  });
  expect(matrix.slice(0, 3)).toEqual(metaRows);
  expect(matrix.slice(33)).toEqual(footerRows);
  expect(matrix[3].slice(10, 17).map((value) => String(value).replace(/\s+/g, " ").trim())).toEqual([
    "İNSERT KALİTESİ", "DEVİR (dev/dk)", "İLERLEME (mm/dk)", "TAKIM ÖMRÜ (ADET)", "ÖZEL", "TAKIM TAM BOY (mm)", "KESME HIZI (m/dk)",
  ]);
  expect(matrix[5].slice(10, 17)).toEqual([p.insert_quality, p.spindle_speed, p.feed_rate, p.tool_life, p.special, p.tool_total_length, p.cutting_speed]);
  const stock = { id: "p1", name: p.name, code: p.code, brand: p.brand, ...Object.fromEntries(shiftedFields.map((key) => [key, `stock ${key}`])) };
  const result = parseCardMatrix(matrix, [stock], []);
  expect(result.warnings).toEqual([]); expect(result.groups).toHaveLength(1);
  for (const key of shiftedFields) expect(result.groups[0].product[key]).toBe(p[key]);
  expect(result.card).toMatchObject({ document_no: recipe.document_no, publication_date: recipe.publication_date, revision_no: recipe.revision_no, revision_date: recipe.revision_date, machine_code: recipe.machine_code, machine_type: recipe.machine_type, prepared_by: recipe.prepared_by, approved_by: recipe.approved_by });
  expect(result.workpiece).toBe(recipe.workpiece_name);
});

it("preserves an explicitly blank cutting speed under the new printed heading instead of using stock speed", async () => {
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: { ...p, cutting_speed: "" }, holder: h }]);
  expect(wb.worksheets[0].getCell("L4").value).toBe("KESME HIZI\n(m/dk)");
  expect(wb.worksheets[0].getCell("L6").value).toBe("");
  const book = XLSX.read(await wb.xlsx.writeBuffer(), { type: "buffer" });
  const matrix = XLSX.utils.sheet_to_json(book.Sheets["Takım Kartı"], { header: 1, defval: "", raw: false });
  const result = parseCardMatrix(matrix, [{ id: "p1", name: p.name, code: p.code, brand: p.brand, cutting_speed: "999 m/dk" }], []);
  expect(result.groups).toHaveLength(1); expect(result.groups[0].product.cutting_speed).toBe("");
});
it("keeps Zoller length optional for old recipes and old exported data", async () => {
  const legacy = { ...p }; delete legacy.tool_total_length;
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: legacy }]);
  expect(wb.worksheets[0].getCell("Q6").value).toBe("");
  const result = parseDetailRows([{ "Takım Adı": p.name, "Takım Kodu": p.code, "Takım Markası": p.brand }], [{ id: "p1", name: p.name, code: p.code, brand: p.brand }], []);
  expect(result.groups[0].product.tool_total_length).toBe("");
});
