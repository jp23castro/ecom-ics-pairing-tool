
const fs = require("fs");
const path = require("path");
const os = require("os");

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function makeScannerCsv(records) {
  const lines = ["BARCODE,QTY"];

  for (const record of records) {
    const barcode = String(record.barcode ?? "");
    const qty = String(record.quantity ?? 0);

    lines.push(`${csvEscape(barcode)},${csvEscape(qty)}`);
  }

  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function saveScannerCsv(records, store, sto) {
  const desktop = path.join(os.homedir(), "Desktop");
  const outputDir = path.join(desktop, "105 CSV");

  fs.mkdirSync(outputDir, { recursive: true });

  const filename = `${store}_STO#${sto}.csv`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, makeScannerCsv(records), "utf8");

  return {
    filename,
    outputPath,
    rowCount: records.length
  };
}

module.exports = { makeScannerCsv, saveScannerCsv };
