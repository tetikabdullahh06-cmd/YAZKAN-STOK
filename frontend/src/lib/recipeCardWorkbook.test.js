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

it("preserves the original F-165 merged headings, logo, footer and all filled values", async () => {
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: p, holder: h }]);
  const buffer = await wb.xlsx.writeBuffer(); const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(buffer);
  const ws = loaded.getWorksheet("Takım Kartı");
  for (const address of ["C1", "B4", "D4", "F4", "H4", "I4", "J4", "K4", "L4", "M4", "N4", "O4"]) expect(ws.getCell(address).value).toBeTruthy();
  expect(ws.getCell("A5").value).toBe("TAKIM NO:");
  expect(ws.getCell("M1").value).toContain("09/05/25"); expect(ws.getCell("M1").value).toContain("18/11/26");
  expect(ws.getCell("D2").value).toBe(recipe.workpiece_name); expect(ws.getCell("G3").value).toBe(recipe.machine_code); expect(ws.getCell("H3").value).toBe(recipe.machine_type);
  expect(ws.getCell("P4").value).toBe("TAKIM TAM BOY\n(mm)"); expect(ws.getCell("P6").value).toBe("185,25");
  expect(JSON.stringify(ws.getCell("P4").note)).toContain("ZOLLER TAM BOY ÖLÇÜSÜNÜ GİRİNİZ.");
  expect(ws.getCell("A6").value).toBe("T07"); expect(ws.getCell("B6").value).toBe(p.brand); expect(ws.getCell("J6").value).toBe(p.used_insert);
  expect(ws.getCell("L6").value).toBe(p.spindle_speed); expect(ws.getCell("M6").value).toBe(p.feed_rate);
  expect(ws.getCell("A20").value).toBe("HAZIRLAYAN"); expect(ws.getCell("A21").value).toBe(recipe.prepared_by); expect(ws.getCell("A22").value).toBe("F-165 / R.02 / 15.11.2019");
  expect(ws.getImages()).toHaveLength(1); expect(ws.getCell("A7").value).toBeNull();
  const detail = loaded.getWorksheet("Reçete Verileri"); expect(detail.getCell("E2").numFmt).toBe("dd/mm/yy");
});

it("paginates 29 rows without overwriting footer or losing images", async () => {
  const groups = Array.from({ length: 29 }, (_, i) => ({ product: { ...p, tool_no: String(i + 1), name: `Takım ${i + 1}` }, holder: h }));
  const wb = await buildRecipeCardWorkbook(template, recipe, groups); const buffer = await wb.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(buffer);
  expect(loaded.worksheets).toHaveLength(4);
  [1, 2, 3].forEach((page) => { const ws = loaded.getWorksheet(`Takım Kartı ${page}`); expect(ws.getImages()).toHaveLength(1); expect(ws.getCell("A20").value).toBe("HAZIRLAYAN"); expect(ws.getCell("B4").value).toBe("TAKIM MARKASI"); });
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
  const result = parseCardMatrix(matrix, [{ id: "one", name: "Ø55 ADİK", brand: "TEKNİK", code: "P1" }], []);
  expect(result.groups).toHaveLength(1); expect(result.warnings).toHaveLength(13); expect(result.groups[0].product.spindle_speed).toBe("450"); expect(result.groups[0].holder).toBeNull(); expect(result.card.publication_date).toBe("2025-05-09");
});

it("supports GG/AA/YY input and canonical ISO persistence", () => {
  expect(dateISO("18/11/26")).toBe("2026-11-18"); expect(cardDate("09.05.2025")).toBe("09/05/25");
});

it("creates a completely blank reusable template and deliverable examples", async () => {
  const blank = await buildRecipeCardWorkbook(template, CARD_DEFAULTS, []);
  for (let r = 6; r <= 19; r++) for (let c = 1; c <= 16; c++) expect(blank.worksheets[0].getCell(r, c).value).toBeNull();
  const dir = "/home/ubuntu/deliverables"; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/F-165-zoller-recete-sablonu.xlsx`, await blank.xlsx.writeBuffer());
  const example = await buildRecipeCardWorkbook(template, recipe, [{ product: p, holder: h }]);
  fs.writeFileSync(`${dir}/F-165-zoller-ornek-recete-karti.xlsx`, await example.xlsx.writeBuffer());
});

it("imports Zoller length from the printed card without relying on the data sheet", async () => {
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: p, holder: h }]);
  const book = XLSX.read(await wb.xlsx.writeBuffer(), { type: "buffer" });
  const matrix = XLSX.utils.sheet_to_json(book.Sheets["Takım Kartı"], { header: 1, defval: "", raw: false });
  const result = parseCardMatrix(matrix, [{ id: "p1", name: p.name, code: p.code, brand: p.brand }], []);
  expect(result.groups).toHaveLength(1); expect(result.groups[0].product.tool_total_length).toBe("185,25");
});
it("keeps Zoller length optional for old recipes and old exported data", async () => {
  const legacy = { ...p }; delete legacy.tool_total_length;
  const wb = await buildRecipeCardWorkbook(template, recipe, [{ product: legacy }]);
  expect(wb.worksheets[0].getCell("P6").value).toBe("");
  const result = parseDetailRows([{ "Takım Adı": p.name, "Takım Kodu": p.code, "Takım Markası": p.brand }], [{ id: "p1", name: p.name, code: p.code, brand: p.brand }], []);
  expect(result.groups[0].product.tool_total_length).toBe("");
});
