import * as XLSX from "xlsx";

export const normalizeHeader = (value) =>
  String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ALIASES = {
  date: ["tarih", "islem tarihi", "hareket tarihi", "date"],
  type: ["tip", "tur", "giris cikis", "islem tipi", "type"],
  productCode: ["urun kodu", "stok kodu", "kod", "product code"],
  productName: ["urun adi", "urun", "stok adi", "product name"],
  quantity: ["miktar", "adet", "quantity"],
  personnel: ["personel", "personel adi", "personel soyadi", "kullanici", "personnel"],
  machineCode: ["tezgah kodu", "makine kodu", "machine code"],
  machineName: ["tezgah", "tezgah adi", "makine", "makine adi", "machine"],
  exitReason: ["cikis nedeni", "islem amaci", "neden", "aciklama", "islem"],
  supplier: ["tedarikci", "supplier"],
  note: ["not", "note"],
  toolholderCode: ["takim tutucu kodu", "tutucu kodu"],
  toolholderName: ["takim tutucu", "tutucu", "tutucu adi"],
  gloveName: ["eldiven", "eldiven adi", "eldiven cinsi", "glove"],
  gloveSize: ["beden", "eldiven bedeni", "size"],
};

const pad = (value) => String(value).padStart(2, "0");

export function toIsoDay(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    return "";
  }
  const raw = String(value).trim();
  let match = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (match) return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
  match = raw.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${pad(match[2])}-${pad(match[1])}`;
  }
  return "";
}

export function toQuantity(value) {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").trim().replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (!raw) return 0;
  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");
  let normalized = raw;
  if (hasDot && hasComma) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if (hasComma) normalized = raw.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toMovementType(value, fallback = "out") {
  const normalized = normalizeHeader(value);
  if (!normalized) return fallback;
  if (["in", "giris", "girdi", "alim", "gelen", "stok giris", "girisler", "iade"].includes(normalized)) return "in";
  if (["out", "cikis", "cikan", "giden", "sarf", "kullanim", "stok cikis", "cikislar"].includes(normalized)) return "out";
  if (normalized.startsWith("gir")) return "in";
  if (normalized.startsWith("cik")) return "out";
  return fallback;
}

function mapHeaders(headerCells) {
  const map = {};
  const normalized = headerCells.map((cell) => normalizeHeader(cell));
  Object.entries(ALIASES).forEach(([field, aliases]) => {
    normalized.forEach((key, index) => {
      if (map[field] != null || !key) return;
      if (aliases.includes(key)) map[field] = index;
    });
  });
  Object.entries(ALIASES).forEach(([field, aliases]) => {
    if (map[field] != null) return;
    normalized.forEach((key, index) => {
      if (map[field] != null || !key) return;
      if (aliases.some((alias) => key.startsWith(alias) || alias.startsWith(key))) map[field] = index;
    });
  });
  return map;
}

function detectHeader(matrix) {
  let best = { index: -1, map: {}, score: 0 };
  matrix.slice(0, 15).forEach((row, index) => {
    const map = mapHeaders(row || []);
    let score = 0;
    if (map.quantity != null) score += 3;
    if (map.productCode != null) score += 2;
    if (map.productName != null) score += 2;
    if (map.gloveName != null) score += 2;
    if (map.date != null) score += 1;
    if (map.type != null) score += 1;
    if (score > best.score) best = { index, map, score };
  });
  if (best.score < 5) return { index: -1, map: {} };
  return best;
}

/**
 * Excel dosyasını hareket satırlarına çevirir.
 * mode: "personnel" | "stock" | "product" | "toolholder"
 * Dönen: { rows, sheets: [{ name, count }] }
 */
export function parseMovementWorkbook(arrayBuffer, mode) {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const rows = [];
  const sheets = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
    if (!matrix.length) return;
    const { index: headerIndex, map } = detectHeader(matrix);
    if (headerIndex < 0) return;

    const sheetKey = normalizeHeader(sheetName);
    const looksGlove = map.gloveName != null || sheetKey.includes("eldiven");
    const looksTool = map.productCode != null || map.productName != null;
    let count = 0;

    for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
      const line = matrix[rowIndex] || [];
      const pick = (field) => (map[field] != null ? line[map[field]] : "");
      const quantity = toQuantity(pick("quantity"));
      const date = toIsoDay(pick("date"));
      const code = String(pick("productCode") ?? "").trim();
      const name = String(pick("productName") ?? "").trim();
      const gloveName = String(pick("gloveName") ?? "").trim();

      if (!quantity || (!code && !name && !gloveName)) continue;

      const base = {
        quantity,
        transaction_date: date,
        personnel_name: String(pick("personnel") ?? "").trim(),
        machine_code: String(pick("machineCode") ?? "").trim(),
        machine_name: String(pick("machineName") ?? "").trim(),
        exit_reason: String(pick("exitReason") ?? "").trim(),
        supplier: String(pick("supplier") ?? "").trim(),
        note: String(pick("note") ?? "").trim(),
        key: `${sheetName}-${rowIndex + 1}`,
      };

      if (mode === "glove") {
        if (!gloveName) continue;
        rows.push({ ...base, kind: "glove", type: "out", glove_name: gloveName, glove_size: String(pick("gloveSize") ?? "").trim() });
        count += 1;
        continue;
      }

      if (mode === "personnel" && looksGlove) {
        rows.push({ ...base, kind: "glove", type: "out", glove_name: gloveName, glove_size: String(pick("gloveSize") ?? "").trim() });
        count += 1;
        continue;
      }
      if (mode === "toolholder") {
        rows.push({
          ...base,
          kind: "toolholder",
          type: toMovementType(pick("type"), "out"),
          toolholder_code: String(pick("toolholderCode") ?? "").trim() || code,
          toolholder_name: String(pick("toolholderName") ?? "").trim() || name,
        });
        count += 1;
        continue;
      }
      if (looksGlove && !looksTool && mode === "personnel") {
        rows.push({ ...base, kind: "glove", type: "out", glove_name: gloveName, glove_size: String(pick("gloveSize") ?? "").trim() });
        count += 1;
        continue;
      }
      if (!code && !name) continue;
      rows.push({
        ...base,
        kind: "product",
        type: mode === "personnel" ? "out" : toMovementType(pick("type"), "out"),
        product_code: code,
        product_name: name,
        toolholder_code: String(pick("toolholderCode") ?? "").trim(),
        toolholder_name: String(pick("toolholderName") ?? "").trim(),
      });
      count += 1;
    }
    if (count) sheets.push({ name: sheetName, count });
  });

  return { rows, sheets };
}
