export const CARD_DEFAULTS = { document_no: "T2.298", publication_date: "2025-05-09", revision_no: "00", revision_date: "", machine_code: "", machine_type: "", operation_no: "20", prepared_by: "", approved_by: "" };
export const LINE_DEFAULTS = { tool_no: "", tool_total_length: "", inner_cooling: "", holder_type: "", holder_length: "", drill_helix_length: "", insert_brand: "", used_insert: "", insert_quality: "", tool_life: "", special: "" };
export const norm = (value = "") => String(value ?? "").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
export const asText = (value) => String(value ?? "");

export function dateISO(value) {
  const raw = asText(value).trim();
  if (!raw) return "";
  let iso = "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) iso = raw.slice(0, 10);
  const m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/);
  if (!iso && m) iso = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (!iso) return "";
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : "";
}
export function cardDate(value) { const iso = dateISO(value); return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : ""; }

export function groupRecipeLines(lines = []) {
  const groups = [];
  lines.forEach((line, i) => {
    if (line.pair_id) {
      let g = groups.find((x) => x.pairId === line.pair_id);
      if (!g) { g = { pairId: line.pair_id, product: null, holder: null }; groups.push(g); }
      g[line.kind === "toolholder" ? "holder" : "product"] = { ...line };
    } else if (line.kind === "toolholder" && groups.length && !groups[groups.length - 1].holder) {
      groups[groups.length - 1].holder = { ...line };
    } else {
      groups.push({ pairId: `legacy-${i}`, product: line.kind === "toolholder" ? null : { ...line }, holder: line.kind === "toolholder" ? { ...line } : null });
    }
  });
  return groups;
}

// An empty code or brand alone must NEVER select an arbitrary stock item.
export function matchStock(items, { id = "", code = "", name = "", brand = "" }) {
  if (id) { const found = items.find((x) => x.id === id); if (found) return found; }
  let candidates = [];
  if (norm(code)) candidates = items.filter((x) => norm(x.code) && norm(x.code) === norm(code));
  if (!candidates.length && norm(name)) candidates = items.filter((x) => norm(x.name) === norm(name));
  if (norm(brand)) candidates = candidates.filter((x) => norm(x.brand) === norm(brand));
  return candidates.length === 1 ? candidates[0] : null;
}

export function detailRows(recipe, groups) {
  return groups.map((g, i) => {
    const p = g.product || {}, h = g.holder || {};
    return { "Reçete Adı": recipe.name || "", "İşlenecek Ürün": recipe.workpiece_name || "", Not: recipe.note || "", "Doküman No": recipe.document_no ?? CARD_DEFAULTS.document_no, "Yayın Tarihi": dateISO(recipe.publication_date ?? CARD_DEFAULTS.publication_date), "Revizyon No": recipe.revision_no ?? "00", "Revizyon Tarihi": dateISO(recipe.revision_date), "Makina Kodu": recipe.machine_code || "", "Makina Tipi": recipe.machine_type || "", "Operasyon No": recipe.operation_no ?? "20", Hazırlayan: recipe.prepared_by || "", Onaylayan: recipe.approved_by || "", "Takım No": p.tool_no || i + 1, "Takım Kodu": p.code || "", "Takım Adı": p.name || "", "Takım Markası": p.brand || "", "Takım Miktarı": p.quantity ?? "", "İşleme Boyu": p.machining_length || "", "Takım Tam Boy (mm)": p.tool_total_length || "", "Kesme Hızı": p.cutting_speed || "", Devir: p.spindle_speed || "", İlerleme: p.feed_rate || "", "İçten Soğutma": p.inner_cooling || "", "Tutucu Tipi": p.holder_type || "", "Tutucu Boyu": p.holder_length || "", "Matkap Helis Boyu": p.drill_helix_length || "", "İnsert Markası": p.insert_brand || "", "Kullanılan İnsert": p.used_insert || "", "İnsert Kalitesi": p.insert_quality || "", "Takım Ömrü": p.tool_life || "", Özel: p.special || "", "Tutucu Kodu": h.code || "", "Tutucu Adı": h.name || "", "Tutucu Markası": h.brand || "", "Tutucu Miktarı": h.quantity ?? "" };
  });
}

export function parseDetailRows(rows, products, holders) {
  const warnings = [], groups = [];
  rows.forEach((row, i) => {
    if (!row["Takım Adı"] && !row["Takım Kodu"]) return;
    const p = matchStock(products, { code: row["Takım Kodu"], name: row["Takım Adı"], brand: row["Takım Markası"] });
    if (!p) { warnings.push(`${i + 1}. satır: ${row["Takım Adı"] || row["Takım Kodu"]} stokta tekil eşleşmedi`); return; }
    const pairId = `import-${Date.now()}-${i}`;
    const product = { kind: "product", pair_id: pairId, reference_id: p.id, name: p.name, code: p.code || "", brand: p.brand || "", quantity: Number(row["Takım Miktarı"]) || 1, machining_length: asText(row["İşleme Boyu"]), tool_total_length: asText(row["Takım Tam Boy (mm)"] ?? row["Takım Tam Boy"]), cutting_speed: asText(row["Kesme Hızı"]), spindle_speed: asText(row.Devir), feed_rate: asText(row.İlerleme), tool_no: asText(row["Takım No"]), inner_cooling: asText(row["İçten Soğutma"]), holder_type: asText(row["Tutucu Tipi"]), holder_length: asText(row["Tutucu Boyu"]), drill_helix_length: asText(row["Matkap Helis Boyu"]), insert_brand: asText(row["İnsert Markası"]), used_insert: asText(row["Kullanılan İnsert"]), insert_quality: asText(row["İnsert Kalitesi"]), tool_life: asText(row["Takım Ömrü"]), special: asText(row.Özel) };
    let holder = null;
    if (row["Tutucu Adı"] || row["Tutucu Kodu"]) {
      const h = matchStock(holders, { name: row["Tutucu Adı"], code: row["Tutucu Kodu"], brand: row["Tutucu Markası"] });
      if (h) holder = { kind: "toolholder", pair_id: pairId, reference_id: h.id, name: h.name, code: h.code || "", brand: h.brand || "", quantity: Number(row["Tutucu Miktarı"]) || 1 };
      else warnings.push(`${i + 1}. satır: tutucu stokta tekil eşleşmedi; stok bağlantısı yapılmadı`);
    }
    groups.push({ pairId, product, holder });
  });
  const first = rows[0] || {};
  const card = { document_no: asText(first["Doküman No"] || CARD_DEFAULTS.document_no), publication_date: dateISO(first["Yayın Tarihi"]) || CARD_DEFAULTS.publication_date, revision_no: asText(first["Revizyon No"] ?? "00"), revision_date: dateISO(first["Revizyon Tarihi"]), machine_code: asText(first["Makina Kodu"]), machine_type: asText(first["Makina Tipi"]), operation_no: asText(first["Operasyon No"] ?? "20"), prepared_by: asText(first.Hazırlayan), approved_by: asText(first.Onaylayan) };
  return { groups, warnings, card, name: asText(first["Reçete Adı"]), workpiece: asText(first["İşlenecek Ürün"]), note: asText(first.Not) };
}

export function parseCardMatrix(matrix, products, holders) {
  const warnings = [], groups = [];
  const header = matrix.findIndex((row) => norm(row[0]).includes("takim no") || norm(row[2]).includes("operasyon"));
  if (header < 0) throw new Error("F-165 kart başlıkları bulunamadı");
  const totalLengthColumn = matrix[header].findIndex((value) => norm(value).includes("takim tam boy"));
  const r2 = matrix[1] || [], r3 = matrix[2] || [];
  const meta = asText(matrix[0]?.[12]);
  const extract = (key) => meta.match(new RegExp(`${key}\\s*:\\s*([^\\n]*)`, "i"))?.[1]?.trim() || "";
  const card = { ...CARD_DEFAULTS, document_no: extract("Doküman No") || CARD_DEFAULTS.document_no, publication_date: dateISO(extract("Yayın Tarihi")) || CARD_DEFAULTS.publication_date, revision_no: extract("Revizyon No") || "00", revision_date: dateISO(extract("Revizyon Tarihi")), machine_code: asText(r3[6] || asText(r3[1]).replace(/^MAKİNA KODU:\s*/i, "")), machine_type: asText(r3[7] || asText(r3[3]).replace(/^MAKİNA TİPİ\s*:\s*/i, "")), operation_no: asText(matrix[header]?.[2]).replace(/^OPERASYON\s*/i, "") || "20" };
  const name = asText(r2[3] || r2[1]);
  for (let i = header + 2; i < matrix.length; i++) {
    const row = matrix[i];
    if (norm(row[0]).includes("hazirlayan")) { card.prepared_by = asText(matrix[i + 1]?.[0]); card.approved_by = asText(matrix[i + 1]?.[2]); break; }
    if (!asText(row[0]).trim() || !row[2]) continue;
    const p = matchStock(products, { name: row[2], brand: row[1] });
    if (!p) { warnings.push(`${row[0]}. takım: ${row[2]} stokta tekil eşleşmedi; adı/markayı kontrol edin`); continue; }
    const pairId = `card-${Date.now()}-${i}`;
    const product = { kind: "product", pair_id: pairId, reference_id: p.id, name: p.name, code: p.code || "", brand: p.brand || "", quantity: 1, ...LINE_DEFAULTS, tool_no: asText(row[0]), inner_cooling: row[3] ? "VAR" : row[4] ? "YOK" : "", holder_type: asText(row[5]), holder_length: asText(row[6]), drill_helix_length: asText(row[7]), insert_brand: asText(row[8]), used_insert: asText(row[9]), insert_quality: asText(row[10]), spindle_speed: asText(row[11]), feed_rate: asText(row[12]), tool_life: asText(row[13]), special: asText(row[14]), tool_total_length: totalLengthColumn >= 0 ? asText(row[totalLengthColumn]) : "", cutting_speed: asText(p.cutting_speed), machining_length: "" };
    // A holder TYPE (e.g. VELDON) is not a unique stock record. Preserve text only.
    groups.push({ pairId, product, holder: null });
  }
  return { groups, warnings, card, name: name ? `${name} Takım Kartı` : "İçe Aktarılan Takım Kartı", workpiece: name, note: "" };
}
