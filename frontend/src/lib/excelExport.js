import ExcelJS from "exceljs";

export async function downloadImageWorkbook({ sheetName, rows, filename, imageKey = "Görsel URL" }) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = rows.length ? Object.keys(rows[0]) : [imageKey];

  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: header === imageKey ? 24 : Math.max(14, Math.min(28, String(header).length + 4)),
  }));
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };

  rows.forEach((row) => worksheet.addRow(row));
  const imageColumn = headers.indexOf(imageKey);
  if (imageColumn >= 0) {
    rows.forEach((row, index) => {
      const imageUrl = String(row[imageKey] || "");
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

export function hasEmbeddedImages(rows, imageKey = "Görsel URL") {
  return rows.some((row) => String(row[imageKey] || "").startsWith("data:image/"));
}

export function imageExportNotice(rows, imageKey = "Görsel URL") {
  return hasEmbeddedImages(rows, imageKey)
    ? "Görseller Excel hücrelerine gömüldü"
    : "Görsel URL alanı korundu; görsel bulunmayan kayıtlar metin olarak kaldı";
}
