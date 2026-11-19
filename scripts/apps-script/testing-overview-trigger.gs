const SPREADSHEET_ID = "18UpYEKlrgZnuRyYoGwu8P4pAQqdBtgvxRkMjMYVCSgo";
const SOURCE_SHEET = "Okt 2026 - testing";
const OUTPUT_SHEET = "Version 3.0 testing";
const OPERATIONAL_OVERVIEW_SHEET = "Overview Operasional - testing";
const PLOT_MASTER_SHEET = "Master Harga Petak - testing";
const FUEL_SHEET = "Pengambilan Solar - testing";
const ADMIN_SHEET = "Administrasi SPK - testing";
const HEADERS = ["No", "No. SPK", "Dokumen SPK", "No. Berita Acara", "Dokumen Berita Acara", "No. Pencairan", "Bukti Pencairan", "Kode Petak", "Luas Petak (Ha)", "Harga Per Hektar", "Total Harga Per Petak", "Total Harga Setelah Pajak", "Total Konsumsi Solar", "Tanggal", "Pembelian Solar ( L )", "Harga Solar", "Total Harga Solar", "HM Awal", "HM Akhir", "HM Kerja (Jam)", "Est. Jam Kerja", "Pengisian Solar (L)", "Pemakaian Solar per Jam (L/Hr)", "Pemakaian Solar Riil (L)", "Status Pekerjaan", "Keterangan"];
const SHEETS_THAT_REFRESH = [SOURCE_SHEET, PLOT_MASTER_SHEET, FUEL_SHEET, ADMIN_SHEET];

function installTestingOverviewTrigger() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (SHEETS_THAT_REFRESH.concat(OUTPUT_SHEET, OPERATIONAL_OVERVIEW_SHEET).some((name) => !ss.getSheetByName(name))) {
    throw new Error("Pastikan seluruh tab testing sumber, master, administrasi, dan Version 3.0 testing tersedia.");
  }
  const handlers = ["syncPetakV3TestingOverview", "syncPetakV3TestingOverviewOnEdit"];
  ScriptApp.getProjectTriggers().filter((trigger) => handlers.includes(trigger.getHandlerFunction())).forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("syncPetakV3TestingOverview").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("syncPetakV3TestingOverviewOnEdit").forSpreadsheet(SPREADSHEET_ID).onEdit().create();
  syncPetakV3TestingOverview();
}

function syncPetakV3TestingOverviewOnEdit(e) {
  if (e && e.range && SHEETS_THAT_REFRESH.includes(e.range.getSheet().getName())) syncPetakV3TestingOverview();
}

function syncPetakV3TestingOverview() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const source = ss.getSheetByName(SOURCE_SHEET);
    const outputSheet = ss.getSheetByName(OUTPUT_SHEET);
    const plotMaster = ss.getSheetByName(PLOT_MASTER_SHEET);
    const fuelSheet = ss.getSheetByName(FUEL_SHEET);
    const adminSheet = ss.getSheetByName(ADMIN_SHEET);
    const formatTemplate = ss.getSheetByName("Version 3.0");
    if ([source, outputSheet, plotMaster, fuelSheet, adminSheet, formatTemplate].some((sheet) => !sheet)) throw new Error("Tab testing untuk sinkronisasi overview tidak ditemukan.");

    const spkByCode = new Map();
    if (plotMaster.getLastRow() >= 6) plotMaster.getRange(6, 2, plotMaster.getLastRow() - 5, 3).getDisplayValues().forEach(([spk, code, rate]) => {
      if (code) spkByCode.set(String(code).trim(), { spk: String(spk || "").trim(), rate: parseNumber_(rate) });
    });
    const adminBySpk = new Map();
    if (adminSheet.getLastRow() >= 2) adminSheet.getRange(2, 1, adminSheet.getLastRow() - 1, 6).getDisplayValues().forEach((row) => {
      if (row[0]) adminBySpk.set(String(row[0]).trim(), row);
    });
    const transactions = new Map();
    const purchasesByPlot = new Map();
    const fuelPrices = fuelSheet.getLastRow() >= 4 ? fuelSheet.getRange(4, 9, fuelSheet.getLastRow() - 3, 3).getValues()
      .map((row) => ({ date: dateSerial_(row[0]), price: parseNumber_(row[1]), active: row[2] === true || String(row[2]).toUpperCase() === "TRUE" }))
      .filter((row) => row.date != null && row.price > 0 && row.active)
      .sort((a, b) => a.date - b.date) : [];
    const priceOn = (date) => fuelPrices.filter((item) => item.date <= date).pop()?.price || 0;
    if (fuelSheet.getLastRow() > 0) fuelSheet.getRange(1, 1, fuelSheet.getLastRow(), 6).getValues().forEach((row) => {
      if (typeof row[0] !== "number" || !row[1] || row[2] == null || !row[3]) return;
      const date = dateSerial_(row[1]);
      const liters = parseNumber_(row[2]);
      const code = String(row[3]).trim();
      if (date == null || liters <= 0) return;
      const key = `${code}|${date}`;
      const purchase = transactions.get(key) || { liters: 0, pricedLiters: 0, amount: 0 };
      const amount = parseNumber_(row[5]);
      const recordedPrice = parseNumber_(row[4]);
      const price = recordedPrice || priceOn(date);
      const hasPrice = price > 0;
      const hasAmount = row[5] !== "" && row[5] != null;
      purchase.liters += liters;
      if (hasPrice || hasAmount) {
        const knownAmount = hasAmount ? amount : price * liters;
        purchase.amount += knownAmount;
        purchase.pricedLiters += liters;
      }
      transactions.set(key, purchase);
      if (hasPrice || hasAmount) {
        const plotPurchase = purchasesByPlot.get(code) || { liters: 0, amount: 0, count: 0 };
        plotPurchase.liters += liters;
        plotPurchase.amount += hasAmount ? amount : price * liters;
        plotPurchase.count++;
        purchasesByPlot.set(code, plotPurchase);
      }
    });

    const sourceRows = source.getRange(1, 1, source.getLastRow(), 16).getValues();
    const output = [];
    const plotGroups = [];
    let plot = null;
    let activityCount = 0;
    for (let i = 0; i < sourceRows.length; i++) {
      const row = sourceRows[i] || [];
      if (row[0] === "Kode Petak") {
        if (plot) plotGroups[plotGroups.length - 1].endRow = output.length + 1;
        const code = String(row[2] || "").trim();
        if (!code) throw new Error(`Kode petak kosong pada baris ${i + 1}; output tidak diperbarui.`);
        const master = spkByCode.get(code) || { spk: "", rate: 0 };
        const area = parseNumber_((sourceRows[i + 3] || [])[2]);
        const liters = parseNumber_((sourceRows[i + 4] || [])[2]);
        const purchase = purchasesByPlot.get(code) || { liters: 0, amount: 0, count: 0 };
        plot = { code, spk: master.spk, rate: master.rate, area, liters, purchasePrice: purchase.liters ? purchase.amount / purchase.liters : "", purchaseAmount: purchase.liters ? purchase.amount : "" };
        const admin = adminBySpk.get(plot.spk) || [];
        plot.admin = admin;
        plotGroups.push({ startRow: 0, endRow: 0, code, purchaseCount: purchase.count });
        continue;
      }
      if (row[0] !== "No" || row[1] !== "Tanggal") continue;
      if (!plot) throw new Error(`Tabel aktivitas tanpa petak pada baris ${i + 1}; output tidak diperbarui.`);
      const activityHeaders = ["No", "Tanggal", "HM Awal", "HM Akhir", "HM Kerja (Jam)", "Est. Jam Kerja", "Pengisian Solar (L)", "Pemakaian Solar per Jam (L/Hr)", "Pemakaian Solar Riil (L)", "Sisa/Stok Tangki (L)", "Status Pekerjaan", "Keterangan"];
      if (activityHeaders.some((header, column) => row[column] !== header)) throw new Error(`Header aktivitas berubah pada baris ${i + 1}; output tidak diperbarui.`);
      for (let j = i + 1; j < sourceRows.length; j++) {
        const activity = sourceRows[j] || [];
        if (["Total", "Rata-Rata", "Kode Petak"].includes(activity[0])) break;
        if (!activity.slice(1, 12).some((value) => value !== "" && value != null)) continue;
        const date = dateSerial_(activity[1]);
        if (date == null) throw new Error(`Tanggal aktivitas tidak valid pada baris ${j + 1}; output tidak diperbarui.`);
        const dailyPurchase = transactions.get(`${plot.code}|${date}`) || { liters: 0, pricedLiters: 0, amount: 0 };
        activityCount++;
        const firstActivity = !plotGroups[plotGroups.length - 1].startRow;
        if (firstActivity) plotGroups[plotGroups.length - 1].startRow = output.length + 2;
        const plotValue = plot.area * plot.rate;
        output.push([activityCount, firstActivity ? plot.spk : "", firstActivity ? plot.admin[1] || "" : "", firstActivity ? plot.admin[2] || "" : "", firstActivity ? plot.admin[3] || "" : "", firstActivity ? plot.admin[4] || "" : "", firstActivity ? plot.admin[5] || "" : "", plot.code, firstActivity ? plot.area : "", firstActivity ? plot.rate : "", firstActivity ? plotValue : "", firstActivity ? plotValue * 0.98 : "", firstActivity ? plot.liters : "", date, dailyPurchase.liters, firstActivity ? plot.purchasePrice : "", firstActivity ? plot.purchaseAmount : "", ...activity.slice(2, 9), activity[10] ?? "", activity[11] ?? ""]);
      }
    }
    if (plot) plotGroups[plotGroups.length - 1].endRow = output.length + 1;
    if (!activityCount) throw new Error("Tidak ada aktivitas harian; output tidak dikosongkan.");
    const totals = Array(HEADERS.length).fill("");
    totals[0] = "Total";
    [8, 10, 11, 12, 14, 16, 19, 20, 21, 23].forEach((column) => { totals[column] = output.reduce((sum, row) => sum + parseNumber_(row[column]), 0); });
    const hourlyRates = output.filter((row) => typeof row[0] === "number").map((row) => parseNumber_(row[22])).filter((value) => value > 0);
    totals[22] = hourlyRates.length ? hourlyRates.reduce((sum, value) => sum + value, 0) / hourlyRates.length : "";
    const pricedLiters = [...purchasesByPlot.values()].reduce((sum, purchase) => sum + purchase.liters, 0);
    totals[15] = pricedLiters ? totals[16] / pricedLiters : "";
    output.push(totals);
    if (output.some((row) => row.length !== HEADERS.length)) throw new Error("Jumlah kolom output tidak sesuai; output tidak diperbarui.");

    const oldLastRow = Math.max(outputSheet.getLastRow(), output.length + 1);
    const clearWidth = Math.max(outputSheet.getLastColumn(), HEADERS.length);
    const totalRow = output.length + 1;
    outputSheet.getRange(2, 2, oldLastRow - 1, 6).breakApart();
    outputSheet.getRange(2, 8, oldLastRow - 1, 6).breakApart();
    outputSheet.getRange(2, 16, oldLastRow - 1, 2).breakApart().clearNote();
    formatTemplate.getRange(12, 1, 1, HEADERS.length).copyTo(outputSheet.getRange(totalRow, 1, 1, HEADERS.length), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    outputSheet.getRange(2, 1, oldLastRow - 1, clearWidth).clearContent();
    outputSheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    outputSheet.getRange(2, 1, output.length, HEADERS.length).setValues(output);
    if (output.length > 2) outputSheet.getRange(2, 1, 1, HEADERS.length).copyTo(outputSheet.getRange(3, 1, output.length - 2, HEADERS.length), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    outputSheet.getRange(2, 10, totalRow - 1, 3).setNumberFormat('"Rp" #,##0');
    outputSheet.getRange(2, 16, totalRow - 1, 2).setNumberFormat('"Rp" #,##0');
    plotGroups.filter((group) => group.startRow && group.endRow > group.startRow).forEach((group) => {
      outputSheet.getRange(group.startRow, 2, group.endRow - group.startRow + 1, 6).mergeVertically();
      outputSheet.getRange(group.startRow, 2, group.endRow - group.startRow + 1, 6).setVerticalAlignment("middle");
      outputSheet.getRange(group.startRow, 8, group.endRow - group.startRow + 1, 6).mergeVertically();
      outputSheet.getRange(group.startRow, 8, group.endRow - group.startRow + 1, 6).setVerticalAlignment("middle");
      outputSheet.getRange(group.startRow, 16, group.endRow - group.startRow + 1, 2).mergeVertically();
      outputSheet.getRange(group.startRow, 16, group.endRow - group.startRow + 1, 2).setVerticalAlignment("middle");
      if (group.purchaseCount) {
        const note = `Harga mengikuti data transaksi atau harga master yang berlaku; mencakup ${group.purchaseCount} transaksi.`;
        outputSheet.getRange(group.startRow, 16, 1, 2).setNotes([[note, note]]);
      }
    });
    if (pricedLiters) {
      const note = `Harga mengikuti data transaksi atau harga master yang berlaku; mencakup ${[...purchasesByPlot.values()].reduce((sum, purchase) => sum + purchase.count, 0)} transaksi.`;
      outputSheet.getRange(totalRow, 16, 1, 2).setNotes([[note, note]]);
    }
    outputSheet.getRange(totalRow, 1, 1, 8).merge().setHorizontalAlignment("left").setVerticalAlignment("middle");
    SpreadsheetApp.flush();
    syncOperationalSpk_(ss, spkByCode);
  } finally {
    lock.releaseLock();
  }
}

function syncOperationalSpk_(ss, spkByCode) {
  const sheet = ss.getSheetByName(OPERATIONAL_OVERVIEW_SHEET);
  if (!sheet) throw new Error(`Tab ${OPERATIONAL_OVERVIEW_SHEET} tidak ditemukan.`);
  const headers = sheet.getRange(1, 1, 1, 3).getDisplayValues()[0].map((value) => String(value).trim());
  if (headers[0] !== "No" || headers[1] !== "No. SPK" || headers[2] !== "Kode Petak") {
    throw new Error(`Header ${OPERATIONAL_OVERVIEW_SHEET} berubah; kolom SPK tidak diperbarui.`);
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const values = sheet.getRange(2, 3, lastRow - 1, 1).getDisplayValues()
    .map(([code]) => [spkByCode.get(String(code || "").trim())?.spk || ""]);
  sheet.getRange(2, 2, values.length, 1).setValues(values);
}

function parseNumber_(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  return Number(cleaned) || 0;
}

function dateSerial_(value) {
  if (typeof value === "number") return Math.floor(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const date = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd").split("-").map(Number);
    return Math.round((Date.UTC(date[0], date[1] - 1, date[2]) - Date.UTC(1899, 11, 30)) / 86400000);
  }
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? Math.round((Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) - Date.UTC(1899, 11, 30)) / 86400000) : null;
}

