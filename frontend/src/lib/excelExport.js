import ExcelJS from "exceljs";

export async function downloadImageWorkbook({ sheetName, rows, filename, imageKey = "Görsel", imageSourceKey = "__imageUrl", includeImages = true }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = rows.length ? Object.keys(rows[0]).filter((key) => !key.startsWith("__") && (includeImages || key !== imageKey)) : (includeImages ? [imageKey] : []);

  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: header === imageKey ? 24 : Math.max(14, Math.min(28, String(header).length + 4)),
  }));
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };

  rows.forEach((row) => worksheet.addRow(row));
  if (headers.length) {
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  const imageColumn = headers.indexOf(imageKey);
  if (includeImages && imageColumn >= 0) {
    rows.forEach((row, index) => {
      const imageCell = worksheet.getCell(index + 2, imageColumn + 1);
      imageCell.value = null;
      const imageUrl = String(row[imageSourceKey] || "");
      if (!imageUrl.startsWith("data:image/")) return;
      const extension = imageUrl.startsWith("data:image/png") ? "png" : "jpeg";
      const imageId = workbook.addImage({ base64: imageUrl, extension });
      worksheet.addImage(imageId, {
        tl: { col: imageColumn + 0.08, row: index + 1.08 },
        ext: { width: 82, height: 68 },
      });
      worksheet.getRow(index + 2).height = 58;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadPlainWorkbook({ sheetName, rows, filename }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = rows.length ? Object.keys(rows[0]).filter((key) => !key.startsWith("__") && key !== "Görsel" && key !== "Görsel URL") : [];
  worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(14, Math.min(28, String(header).length + 4)) }));
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  rows.forEach((row) => {
    const plain = {};
    headers.forEach((header) => { plain[header] = row[header] ?? ""; });
    worksheet.addRow(plain);
  });
  if (headers.length) {
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: headers.length } };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function hasEmbeddedImages(rows, imageSourceKey = "__imageUrl") {
  return rows.some((row) => String(row[imageSourceKey] || "").startsWith("data:image/"));
}

export function imageExportNotice(rows, imageSourceKey = "__imageUrl") {
  return hasEmbeddedImages(rows, imageSourceKey)
    ? "Görseller Excel hücrelerine gömüldü"
    : "Görsel URL alanı korundu; görsel bulunmayan kayıtlar metin olarak kaldı";
}
