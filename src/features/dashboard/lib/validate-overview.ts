import { overviewColumns, type DataQualityIssue, type NumericField, type OverviewRecord, type OverviewField, type ProcessingOptions, type ValidatedOverviewRecord } from "../types";
import { validDate } from "./normalize-overview";

export function validateOverview(records: readonly OverviewRecord[], options: ProcessingOptions = {}) {
  const issues: DataQualityIssue[] = [];
  const fingerprints = new Map<string, number>();
  const validated = [...records].sort((a, b) => a.source.row - b.source.row).map((record): ValidatedOverviewRecord => {
    const invalidFields: OverviewField[] = overviewColumns.filter(({ field }) => record.cellStates[field] !== "valid").map(({ field }) => field);
    const add = (code: DataQualityIssue["code"], field: OverviewField, message: string, severity: DataQualityIssue["severity"] = "error") => {
      issues.push({ source: record.source, code, field, message, severity });
    };
    if (!record.plotCode) {
      for (const field of ["plotArea", "totalFuelConsumption"] as const) {
        if (record.cellStates[field] !== "missing") add("metadata_unassigned", field, "Metadata tidak dapat dikaitkan karena kode petak tidak tersedia.", "warning");
      }
    }
    for (const field of ["plotArea", "fuelRefill", "actualFuelUsage", "workingHours", "remainingFuel"] as const satisfies readonly NumericField[]) {
      if (record[field] !== null && record[field] < 0) {
        invalidFields.push(field);
        add("negative_value", field, "Nilai negatif disimpan, tetapi tidak dipakai pada metrik terkait.");
      }
    }
    if (record.plotArea === 0) {
      invalidFields.push("plotArea");
      add("zero_area", "plotArea", "Luas nol memerlukan tinjauan sebelum digunakan sebagai metadata petak.", "warning");
    }
    if (record.hmStart !== null && record.hmEnd !== null) {
      const difference = record.hmEnd - record.hmStart;
      if (difference < 0) {
        invalidFields.push("hmEnd", "workingHours");
        add("hm_reversed", "hmEnd", "HM akhir lebih kecil dari HM awal; HM kerja dan efisiensi perlu ditinjau.");
      } else if (record.workingHours !== null && Math.abs(difference - record.workingHours) > 1e-6) {
        invalidFields.push("workingHours");
        add("hm_mismatch", "workingHours", "HM kerja tidak sesuai selisih HM; nilai sumber tidak dikoreksi otomatis.", "warning");
      }
    }
    // Include invalid raw cells so different parsing failures cannot collapse into one duplicate.
    const fingerprint = JSON.stringify(overviewColumns.map(({ field }, index) =>
      record.cellStates[field] === "invalid" ? ["invalid", typeof record.raw[index], String(record.raw[index])] : record[field]));
    const duplicateOf = fingerprints.get(fingerprint) ?? null;
    if (duplicateOf !== null) issues.push({ source: record.source, field: null, code: "duplicate_record", severity: "warning", relatedRows: [duplicateOf], message: `Duplikat tepat dari baris ${duplicateOf}; hanya baris pertama masuk perhitungan.` });
    else fingerprints.set(fingerprint, record.source.row);
    const efficiencyEligible = !invalidFields.includes("actualFuelUsage") && !invalidFields.includes("workingHours") && record.workingHours !== null && record.workingHours > 0;
    const hasMeasurement = record.actualFuelUsage !== null || record.workingHours !== null;
    if (!efficiencyEligible && (record.actualFuelUsage !== 0 || record.workingHours !== 0)) {
      add("unpaired_measurements", "actualFuelUsage", "Pasangan solar riil dan HM positif yang valid tidak tersedia; aktivitas tidak dipakai untuk efisiensi.", hasMeasurement ? "warning" : "info");
    }
    return { record, invalidFields: [...new Set(invalidFields)], efficiencyEligible, duplicateOf };
  });
  const active = validated.filter((row) => row.duplicateOf === null && row.record.plotCode);
  for (const rows of Map.groupBy(active, (row) => row.record.plotCode).values()) {
    if (!rows.some((row) => validDate(row.record.date))) {
      issues.push({ source: rows[0].record.source, field: "date", code: "undated_plot", severity: "warning", relatedRows: rows.map((row) => row.record.source.row), message: "Petak terdaftar tanpa aktivitas bertanggal yang valid; tidak dihitung sebagai aktivitas periode." });
    }
    const areaRows = rows.filter((row) => row.record.plotArea !== null && row.record.plotArea >= 0 && row.record.cellStates.plotArea === "valid");
    if (new Set(areaRows.map((row) => row.record.plotArea)).size > 1) {
      for (const row of rows) {
        if (!row.invalidFields.includes("plotArea")) row.invalidFields.push("plotArea");
        issues.push({ source: row.record.source, field: "plotArea", code: "area_conflict", severity: "warning", relatedRows: areaRows.map((row) => row.record.source.row), message: "Luas petak tidak konsisten; luas petak dan total luas memerlukan tinjauan." });
      }
    }
    const cumulativeRows = rows.filter((row) => row.record.totalFuelConsumption !== null);
    if (new Set(cumulativeRows.map((row) => row.record.totalFuelConsumption)).size > 1) {
      for (const row of cumulativeRows) issues.push({ source: row.record.source, field: "totalFuelConsumption", code: "metadata_conflict", severity: "warning", relatedRows: cumulativeRows.map((item) => item.record.source.row), message: "Nilai kumulatif petak berbeda; tidak ada nilai metadata yang dipilih atau dijumlahkan." });
    }
    const dated = rows.filter((row) => validDate(row.record.date) && row.record.workStatus !== null);
    for (const sameDate of Map.groupBy(dated, (row) => row.record.date).values()) {
      if (new Set(sameDate.map((row) => row.record.workStatus)).size < 2) continue;
      for (const row of sameDate) issues.push({ source: row.record.source, field: "workStatus", code: "status_conflict", severity: options.sheetOrderConfirmed ? "info" : "warning", relatedRows: sameDate.map((row) => row.record.source.row), message: options.sheetOrderConfirmed ? "Status berbeda pada tanggal sama; urutan baris sumber yang dikonfirmasi menentukan status terakhir." : "Status berbeda pada tanggal sama; urutan entri belum dikonfirmasi sehingga status tanggal ini ambigu." });
    }
  }
  return { records: validated, issues };
}
