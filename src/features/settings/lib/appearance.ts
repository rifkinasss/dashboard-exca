export const themes = {
  orange: { label: "Oranye", color: "#C2410C" },
  blue: { label: "Biru", color: "#1D4ED8" },
  green: { label: "Hijau", color: "#15803D" },
} as const;
export type Theme = keyof typeof themes;
export type Appearance = { name: string; theme: Theme };
export const defaultAppearance: Appearance = { name: "Excavator Management System", theme: "orange" };
export function validateAppearance(name: unknown, theme: unknown): Appearance | null {
  if (typeof name !== "string" || typeof theme !== "string" || !Object.hasOwn(themes, theme)) return null;
  const clean = name.trim();
  if (!clean || clean.startsWith("=") || clean.length > 60 || /[\u0000-\u001f\u007f]/.test(clean)) return null;
  return { name: clean, theme: theme as Theme };
}
export function parseAppearance(rows: unknown): Appearance | null {
  if (!Array.isArray(rows) || rows.length !== 3 || !rows.every(Array.isArray)) return null;
  if (rows[0][0] !== "Kunci" || rows[0][1] !== "Nilai" || rows[1][0] !== "nama_aplikasi" || rows[2][0] !== "warna_utama") return null;
  return validateAppearance(rows[1][1], rows[2][1]);
}
