import { dateISO } from "./recipeCardData";

export const RETURN_CONDITIONS = { healthy: "Sağlam — stoğa ekle", broken: "Kırık — hurdaya ayır", scrap: "Hurda / kullanım dışı" };
export const hasRecipeStockHistory = (recipe) => Boolean(recipe.bound_at || ["bound", "returned"].includes(recipe.status) || recipe.pending_operation || recipe.return_history?.length || recipe.execution_history?.length);
export const canBindRecipe = (recipe) => !recipe.pending_operation && (recipe.status === "draft" || recipe.status === "returned" || (!recipe.status && !hasRecipeStockHistory(recipe)));

export function makeReturnChoices(lines) {
  return Object.fromEntries(lines.map((line) => [line.line_id, {
    selected: false, quantity: String(Math.min(1, Number(line.outstanding_quantity) || 0)), condition: "healthy", note: "",
  }]));
}

export function buildReturnPayload(choices, lines, { request_id, return_date, note = "", execution_id }) {
  if (!request_id) throw new Error("İade işlem kimliği eksik");
  const date = dateISO(return_date);
  if (!date) throw new Error("İade tarihini GG/AA/YY biçiminde girin");
  const items = lines.filter((line) => choices[line.line_id]?.selected).map((line) => {
    const choice = choices[line.line_id];
    const quantity = Number(choice.quantity), remaining = Number(line.outstanding_quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`${line.name}: İade miktarı 0'dan büyük olmalıdır`);
    if (Math.abs(quantity - Math.round(quantity * 1e6) / 1e6) > 1e-9) throw new Error(`${line.name}: Miktar en fazla 6 ondalık basamak içerebilir`);
    if (!Number.isFinite(remaining) || quantity > remaining + 1e-9) throw new Error(`${line.name}: Tezgâhta kalan miktardan fazla iade alınamaz`);
    if (!Object.hasOwn(RETURN_CONDITIONS, choice.condition)) throw new Error(`${line.name}: Sağlam, kırık veya hurda durumunu seçin`);
    return { line_id: line.line_id, quantity: Math.round(quantity * 1e6) / 1e6, condition: choice.condition, note: String(choice.note || "").trim() };
  });
  if (!items.length) throw new Error("Geri gelen en az bir takım veya tutucuyu seçin");
  return { request_id, return_date: date, note: String(note || "").trim(), items, ...(execution_id ? { execution_id } : {}) };
}
