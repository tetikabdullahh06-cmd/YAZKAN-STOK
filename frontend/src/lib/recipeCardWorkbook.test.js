/** @jest-environment node */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { buildRecipeCardWorkbook } from "./recipeCardWorkbook";
import { CARD_DEFAULTS, matchStock, groupRecipeLines, parseDetailRows, dateISO, cardDate, parseCardMatrix } from "./recipeCardData";

const template = fs.readFileSync(path.join(__dirname, "../templates/F-165-original.xlsx"));
const p = { kind: "product", reference_id: "p1", pair_id: "pair1", code: "YZK-01", name: "Ø20 KARBÜR FREZE", brand: "GÜHRİNG", quantity: 2, tool_no: "T07", machining_length: "32 mm", tool_total_length: "185,25", cutting_speed: "65 m/dk", spindle_speed: "1035 dev/dk", feed_rate: "124 mm/dk", inner_cooling: "YOK", holder_type: "HİDROLİK", holder_length: "STANDART", drill_helix_length: "45 mm", insert_brand: "ZCC-CT", used_insert: "TCMT110404", insert_quality: "P25", tool_life: "120", special: "Kaba işleme" };
const h = { kind: "toolholder", reference_id: "h1", pair_id: "pair1", code: "H-01", name: "Hidrolik Tutucu", brand: "AKKO", quantity: 1 };
const recipe = { ...CARD_DEFAULTS, name: "TEST — örnek reçete", workpiece_name: "ÖRNEK PARÇA", machine_code: "DİK-01", machine_type: "CNC DİK İŞLEM", revision_date: "2026-11-18", prepared_by: "Örnek hazırlayan", approved_by: "Örnek onaylayan", note: "Yalnızca test verisi", lines: [p, h] };
const shiftedFields = ["insert_quality", "cutting_speed", "spindle_speed", "feed_rate", "tool_life", "special", "tool_total_length"];

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
  expect(ws.getCell("L6").value).toBe(p.cutting_speed); expect(ws.pageSetup.printArea).toBe("A1:Q22");
  expect(ws.getCell("A6").value).toBe("T07"); expect(ws.getCell("B6").value).toBe(p.brand); expect(ws.getCell("J6").value).toBe(p.used_insert);
  expect(ws.getCell("M6").value).toBe(p.spindle_speed); expect(ws.getCell("N6").value).toBe(p.feed_rate);
  expect(ws.getCell("A20").value).toBe("HAZIRLAYAN"); expect(ws.getCell("A21").value).toBe(recipe.prepared_by); expect(ws.getCell("A22").value).toBe("F-165 / R.02 / 15.11.2019");
  expect(ws.getImages()).toHaveLength(1); expect(ws.getCell("A7").value).toBeNull();
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
  expect(ws.columnCount).toBe(17); expect(ws.pageSetup.printArea).toBe("A1:Q22");
  expect(ws.getCell("Q5").master.address).toBe("Q4");
  expect(JSON.stringify(ws.getCell("Q4").note)).toContain("ZOLLER TAM BOY ÖLÇÜSÜNÜ GİRİNİZ.");
});

it("paginates 29 rows without overwriting footer or losing images", async () => {
  const groups = Array.from({ length: 29 }, (_, i) => ({ product: { ...p, tool_no: String(i + 1), name: `Takım ${i + 1}`, cutting_speed: `${i + 1} m/dk` }, holder: h }));
  const wb = await buildRecipeCardWorkbook(template, recipe, groups); const buffer = await wb.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(buffer);
  expect(loaded.worksheets).toHaveLength(4);
  [1, 2, 3].forEach((page) => {
    const ws = loaded.getWorksheet(`Takım Kartı ${page}`);
    expect(ws.getImages()).toHaveLength(1); expect(ws.getCell("A20").value).toBe("HAZIRLAYAN"); expect(ws.getCell("B4").value).toBe("TAKIM MARKASI");
    expect(ws.getCell("Q4").value).toBe("TAKIM TAM BOY\n(mm)");
    expect(ws.getCell("L4").value).toBe("KESME HIZI\n(m/dk)"); expect(ws.getCell("L5").master.address).toBe("L4");
    expect(ws.pageSetup.printArea).toBe("A1:Q22");
    groups.slice((page - 1) * 14, page * 14).forEach((group, i) => {
      expect(ws.getCell(`Q${i + 6}`).value).toBe(group.product.tool_total_length);
      expect(ws.getCell(`L${i + 6}`).value).toBe(group.product.cutting_speed);
    });
  });
  expect(loaded.getWorksheet("Takım Kartı 1").getCell("C19").value).toBe("Takım 14");
  expect(loaded.getWorksheet("Takım Kartı 2").getCell("C19").value).toBe("Takım 28");
  expect(loaded.getWorksheet("Takım Kartı 3").getCell("C6").value).toBe("Takım 29");
  expect(loaded.getWorksheet("Reçete Verileri").rowCount).toBe(30);
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
  expect(result.groups).toHaveLength(1); expect(result.warnings).toHaveLength(13); expect(result.groups[0].product.spindle_speed).toBe("450"); expect(result.groups[0].holder).toBeNull(); expect(result.card.publication_date).toBe("2025-05-09");
  expect(result.groups[0].product.cutting_speed).toBe("77 m/dk");
});

it("supports GG/AA/YY input and canonical ISO persistence", () => {
  expect(dateISO("18/11/26")).toBe("2026-11-18"); expect(cardDate("09.05.2025")).toBe("09/05/25");
});

it("creates a completely blank reusable template and deliverable examples", async () => {
  const blank = await buildRecipeCardWorkbook(template, CARD_DEFAULTS, []);
  for (let r = 6; r <= 19; r++) for (let c = 1; c <= 17; c++) expect(blank.worksheets[0].getCell(r, c).value).toBeNull();
  const dir = "/home/ubuntu/deliverables"; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/F-165-sirali-recete-sablonu.xlsx`, await blank.xlsx.writeBuffer());
  const example = await buildRecipeCardWorkbook(template, recipe, [{ product: p, holder: h }]);
  fs.writeFileSync(`${dir}/F-165-sirali-ornek-recete-karti.xlsx`, await example.xlsx.writeBuffer());
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
  // Reorder only the two header rows and the 14 body rows, never M1 metadata.
  matrix.slice(3, 19).forEach((row) => {
    const shifted = row.slice(11, 17);
    [1, 2, 3, 4, 5, 0].forEach((source, index) => { row[11 + index] = shifted[source]; });
  });
  expect(matrix.slice(0, 3)).toEqual(metaRows);
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
