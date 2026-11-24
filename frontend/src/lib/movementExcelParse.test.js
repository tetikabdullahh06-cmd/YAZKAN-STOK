/** @jest-environment node */
import * as XLSX from "xlsx";
import { parseMovementWorkbook, toIsoDay, toQuantity, toMovementType } from "./movementExcelParse";

const buildWorkbook = () => {
  const tool = XLSX.utils.aoa_to_sheet([
    ["YAZKAN İŞLEME — PERSONEL TAKIM / ELMAS / UÇ SARFİYATI"],
    ["Personel: Tüm personel · Dönem: 01/11/2026 - 24/11/2026"],
    ["Tarih", "Ürün Kodu", "Ürün Adı", "Marka", "Kategori", "Kalite", "Miktar", "Birim", "Personel", "Tezgâh Kodu", "Tezgâh", "Takım Tutucu", "Üretim / İşlenen Ürün", "Çıkış Nedeni", "Not", "Kullanıcı"],
    [new Date(2026, 10, 10), "U-100", "Kesici Uç 10mm", "TEKNİK", "Kesici Uç", "P25", 3, "adet", "MERTCAN ÇAĞLAMAZ", "YZ-14", "Torna", "", "", "İşleme için verilen", "", "admin"],
    ["11.11.2026", "U-200", "Matkap 8mm", "SANDVIK", "Matkap", "M20", "1,5", "adet", "ALİ VELİ", "", "", "", "", "Aşınmadan dolayı yenileme", "not", "admin"],
  ]);
  const glove = XLSX.utils.aoa_to_sheet([
    ["YAZKAN İŞLEME — PERSONEL ELDİVEN SARFİYATI"],
    ["Personel: Tüm personel · Dönem: 01/11/2026 - 24/11/2026"],
    ["Tarih", "Eldiven", "Beden", "Marka", "Miktar", "Personel", "Not", "Kullanıcı"],
    ["2026-11-11", "Nitril Eldiven", "L", "3M", 2, "MERTCAN ÇAĞLAMAZ", "", "admin"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, tool, "Takım Sarfiyatı");
  XLSX.utils.book_append_sheet(workbook, glove, "Eldiven Sarfiyatı");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
};

test("başlık satırı başlık/alt başlıktan sonra bulunur ve satırlar okunur", () => {
  const parsed = parseMovementWorkbook(buildWorkbook(), "personnel");
  expect(parsed.rows).toHaveLength(3);
  expect(parsed.sheets).toEqual([
    { name: "Takım Sarfiyatı", count: 2 },
    { name: "Eldiven Sarfiyatı", count: 1 },
  ]);
  const [first, second, third] = parsed.rows;
  expect(first).toMatchObject({ kind: "product", type: "out", transaction_date: "2026-11-10", product_code: "U-100", quantity: 3, personnel_name: "MERTCAN ÇAĞLAMAZ", machine_code: "YZ-14" });
  expect(second).toMatchObject({ transaction_date: "2026-11-11", quantity: 1.5, product_code: "U-200", exit_reason: "Aşınmadan dolayı yenileme" });
  expect(third).toMatchObject({ kind: "glove", type: "out", glove_name: "Nitril Eldiven", glove_size: "L", quantity: 2 });
});

test("stok modunda eldiven sayfası ürün olarak okunmaz", () => {
  const parsed = parseMovementWorkbook(buildWorkbook(), "stock");
  expect(parsed.rows).toHaveLength(2);
  expect(parsed.rows.every((row) => row.kind === "product")).toBe(true);
});

test("tarih, miktar ve tip dönüşümleri Türkçe biçimleri kabul eder", () => {
  expect(toIsoDay("24.11.2026")).toBe("2026-11-24");
  expect(toIsoDay("2026-11-24T08:00:00")).toBe("2026-11-24");
  expect(toIsoDay("")).toBe("");
  expect(toQuantity("1.234,5")).toBe(1234.5);
  expect(toQuantity("1,5")).toBe(1.5);
  expect(toQuantity("")).toBe(0);
  expect(toMovementType("Giriş")).toBe("in");
  expect(toMovementType("Çıkış")).toBe("out");
  expect(toMovementType("", "in")).toBe("in");
});
