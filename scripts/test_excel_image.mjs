import fs from "node:fs";
import ExcelJS from "../frontend/node_modules/exceljs/dist/exceljs.min.js";

const image = `data:image/jpeg;base64,${fs.readFileSync("../backend/assets/kilavuz.jpg").toString("base64")}`;
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet("Test");
worksheet.columns = [{ header: "Ürün", key: "name", width: 24 }, { header: "Görsel", key: "image", width: 18 }];
worksheet.addRow({ name: "Kılavuz test", image: "" });
const imageId = workbook.addImage({ base64: image, extension: "jpeg" });
worksheet.addImage(imageId, { tl: { col: 1.08, row: 1.08 }, ext: { width: 82, height: 82 } });
worksheet.getRow(2).height = 70;
const buffer = await workbook.xlsx.writeBuffer();
fs.writeFileSync("/tmp/excel-image-test.xlsx", Buffer.from(buffer));
console.log("created", fs.statSync("/tmp/excel-image-test.xlsx").size);
