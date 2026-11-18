import templateUrl from "../templates/F-165-original.xlsx";
import { buildRecipeCardWorkbook } from "./recipeCardWorkbook";

export async function downloadRecipeCard({ recipe, groups, filename = "F-165-takim-karti.xlsx" }) {
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error("F-165 Excel şablonu yüklenemedi");
  const wb = await buildRecipeCardWorkbook(await response.arrayBuffer(), recipe, groups);
  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
