import "server-only";
import { JWT } from "google-auth-library";
import { readSourceConfig } from "@/features/dashboard/data/server/config";
import { spkDocumentFolders, spkDocumentHeaders, type SpkDocumentField } from "../../lib/spk-document-folders";
import { spkDocumentWorksheet, spkDocumentWriterReady } from "./spk-document-source";

type SaveInput = { number: string; beritaAcaraNumber: string; payoutNumber: string; field?: SpkDocumentField; fileId?: string; accessToken?: string };

export async function saveSpkDocument(input: SaveInput, actor: string): Promise<{ ok: boolean; message: string; uncertain?: boolean; url?: string }> {
  if (!spkDocumentWriterReady()) return { ok: false, message: "Penyimpanan dokumen SPK belum diaktifkan." };
  let submitted = false;
  try {
    const config = readSourceConfig(process.env);
    if (config.source !== "google-sheets") return { ok: false, message: "Sumber data bukan Google Sheets." };
    let fileUrl = "";
    if (input.field || input.fileId || input.accessToken) {
      if (!input.field || !input.fileId || !input.accessToken) return { ok: false, message: "Pilih PDF dan folder dokumen sebelum menyimpan." };
      const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${input.accessToken}` }, signal: AbortSignal.timeout(10000) });
      if (!userResponse.ok) return { ok: false, message: "Akses Google Drive kedaluwarsa. Pilih ulang file dan coba lagi." };
      const user = await userResponse.json() as { email?: string };
      if (user.email?.toLocaleLowerCase("id-ID") !== actor.toLocaleLowerCase("id-ID")) return { ok: false, message: "Akun Drive tidak sama dengan akun administrator yang sedang masuk." };
      const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}?fields=id,name,mimeType,size,parents,webViewLink,appProperties`, { headers: { Authorization: `Bearer ${input.accessToken}` }, signal: AbortSignal.timeout(10000) });
      if (!fileResponse.ok) return { ok: false, message: "File tidak dapat diverifikasi melalui Google Drive." };
      const file = await fileResponse.json() as { id?: string; name?: string; mimeType?: string; size?: string; parents?: string[]; webViewLink?: string; appProperties?: Record<string, string> };
      if (file.id !== input.fileId || file.mimeType !== "application/pdf" || !file.name?.toLocaleLowerCase("id-ID").endsWith(".pdf") || !Number.isFinite(Number(file.size)) || Number(file.size) > 15 * 1024 * 1024 || !file.parents?.includes(spkDocumentFolders[input.field].id) || file.appProperties?.petak_spk_slot !== `${input.number}:${input.field}` || !file.webViewLink?.startsWith("https://drive.google.com/")) return { ok: false, message: `PDF harus tersimpan di folder ${spkDocumentFolders[input.field].name} dan berukuran maksimal 15 MB.` };
      fileUrl = file.webViewLink;
    }

    const jwt = new JWT({ email: config.email, key: config.privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"], transporterOptions: { timeout: 15000, retry: false } });
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}`;
    const metadata = (await jwt.request<unknown>({ url: base, method: "GET", params: { fields: "properties(locale),sheets(properties(title))" }, timeout: 15000, retry: false })).data as { properties?: { locale?: string }; sheets?: { properties?: { title?: string } }[] };
    if (!metadata.sheets?.some((sheet) => sheet.properties?.title === spkDocumentWorksheet) || !["id_ID", "id-ID", "id"].includes(metadata.properties?.locale ?? "")) return { ok: false, message: "Worksheet Administrasi SPK tidak dapat diverifikasi." };
    const range = `'${spkDocumentWorksheet}'!A:H`;
    const current = (await jwt.request<unknown>({ url: `${base}/values/${encodeURIComponent(range)}`, method: "GET", params: { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" }, timeout: 15000, retry: false })).data as { values?: unknown[][] };
    const rows = current.values ?? [];
    if (!spkDocumentHeaders.every((header, index) => rows[0]?.[index] === header)) return { ok: false, message: "Header worksheet administrasi SPK tidak sesuai." };
    const matches = rows.slice(1).map((row, index) => ({ row, number: String(row[0] ?? "").trim(), sheetRow: index + 2 })).filter((item) => item.number === input.number);
    if (matches.length > 1) return { ok: false, message: "Nomor SPK tercatat lebih dari sekali di sheet administrasi." };
    const values = matches[0]?.row ?? [];
    const next = [input.number, String(values[1] ?? ""), input.beritaAcaraNumber, String(values[3] ?? ""), input.payoutNumber, String(values[5] ?? ""), new Date().toISOString(), actor];
    if (input.field === "spk") next[1] = fileUrl;
    if (input.field === "beritaAcara") next[3] = fileUrl;
    if (input.field === "payout") next[5] = fileUrl;
    submitted = true;
    if (matches[0]) {
      const rowNumber = matches[0].sheetRow;
      const data = [
        { range: `'${spkDocumentWorksheet}'!C${rowNumber}`, values: [[next[2]]] },
        { range: `'${spkDocumentWorksheet}'!E${rowNumber}`, values: [[next[4]]] },
        { range: `'${spkDocumentWorksheet}'!G${rowNumber}:H${rowNumber}`, values: [[next[6], next[7]]] },
        ...(input.field === "spk" ? [{ range: `'${spkDocumentWorksheet}'!B${rowNumber}`, values: [[fileUrl]] }] : []),
        ...(input.field === "beritaAcara" ? [{ range: `'${spkDocumentWorksheet}'!D${rowNumber}`, values: [[fileUrl]] }] : []),
        ...(input.field === "payout" ? [{ range: `'${spkDocumentWorksheet}'!F${rowNumber}`, values: [[fileUrl]] }] : []),
      ];
      await jwt.request({ url: `${base}/values:batchUpdate`, method: "POST", data: { valueInputOption: "RAW", data }, timeout: 15000, retry: false });
    } else {
      await jwt.request({ url: `${base}/values/${encodeURIComponent(range)}:append`, method: "POST", params: { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" }, data: { majorDimension: "ROWS", values: [next] }, timeout: 15000, retry: false });
    }
    const rowNumber = matches[0]?.sheetRow ?? rows.length + 1;
    const readback = (await jwt.request<unknown>({ url: `${base}/values/${encodeURIComponent(`'${spkDocumentWorksheet}'!A${rowNumber}:H${rowNumber}`)}`, method: "GET", params: { majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE" }, timeout: 15000, retry: false })).data as { values?: unknown[][] };
    if (String(readback.values?.[0]?.[0] ?? "").trim() !== input.number || input.field === "spk" && readback.values?.[0]?.[1] !== fileUrl || input.field === "beritaAcara" && readback.values?.[0]?.[3] !== fileUrl || input.field === "payout" && readback.values?.[0]?.[5] !== fileUrl) throw new Error("Readback mismatch");
    console.info("spk_document_saved", { actor, worksheet: spkDocumentWorksheet, spk: input.number, field: input.field ?? "metadata", at: new Date().toISOString() });
    return { ok: true, message: "Data berhasil disimpan ke worksheet Administrasi SPK.", ...(fileUrl ? { url: fileUrl } : {}) };
  } catch {
    return submitted ? { ok: false, uncertain: true, message: "Hasil penyimpanan belum dapat dipastikan. Periksa sheet administrasi sebelum mencoba lagi." } : { ok: false, message: "Dokumen belum disimpan. Periksa akses Drive, format worksheet Administrasi SPK, dan izin service account." };
  }
}
