export const spkDocumentFolders = {
  spk: { id: "1q4DhxoZFLpEUyUxRR65b70Wm57zlJy-C", name: "SPK" },
  beritaAcara: { id: "1zABRuPWaJ7refq2gxAhucjmt555sudn-", name: "BA" },
  payout: { id: "1a_hsCKBC48g5ujnx2icFmUssPQcgtbYq", name: "PENCAIRAN" },
} as const;

export const spkDocumentHeaders = [
  "No. SPK", "Dokumen SPK", "No. Berita Acara", "Dokumen Berita Acara",
  "No. Pencairan", "Bukti Pencairan", "Diperbarui Pada", "Diperbarui Oleh",
] as const;

export type SpkDocumentField = "spk" | "beritaAcara" | "payout";
export type SpkDocumentRecord = {
  number: string;
  spkUrl: string;
  beritaAcaraNumber: string;
  beritaAcaraUrl: string;
  payoutNumber: string;
  payoutUrl: string;
  updatedAt: string;
  updatedBy: string;
};

export function spkDocumentStatus(record: SpkDocumentRecord | null) {
  if (!record) return "Belum diunggah";
  const available = [record.spkUrl, record.beritaAcaraUrl, record.payoutUrl].filter(Boolean).length;
  return available === 3 ? "Lengkap" : available > 0 ? `${available} dari 3 dokumen` : "Belum diunggah";
}
