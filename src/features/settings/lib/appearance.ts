export const themes = {
  orange: { label: "Oranye", color: "#C2410C" },
  blue: { label: "Biru", color: "#1D4ED8" },
  green: { label: "Hijau", color: "#15803D" },
} as const;
export type Theme = string;
export function isHexColor(value: string) { return /^#[0-9a-fA-F]{6}$/.test(value); }
export function buttonForeground(color: string) {
  const channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255 * 0.75).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2] > 0.179 ? "#0F172A" : "#fff";
}
export function appearanceColor(theme: Theme) { return Object.hasOwn(themes, theme) ? themes[theme as keyof typeof themes].color : isHexColor(theme) ? theme : themes.orange.color; }

export function secondaryChartColor(theme: Theme) {
  const color = appearanceColor(theme);
  const [red, green, blue] = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
  const chroma = blue - Math.min(red, green);

  if (blue >= Math.max(red, green) && chroma >= 24) {
    const hue = 240 + 60 * (red - green) / chroma;
    if (hue >= 195 && hue <= 260) return "#EA580C";
  }

  return "#2563EB";
}

export type Appearance = { name: string; theme: Theme };
export const defaultAppearance: Appearance = { name: "Excavator Management System", theme: "orange" };
export function validateAppearance(name: unknown, theme: unknown): Appearance | null {
  if (typeof name !== "string" || typeof theme !== "string" || !(Object.hasOwn(themes, theme) || isHexColor(theme))) return null;
  const clean = name.trim();
  if (!clean || clean.startsWith("=") || clean.length > 60 || /[\u0000-\u001f\u007f]/.test(clean)) return null;
  return { name: clean, theme: theme as Theme };
}
export function parseAppearance(rows: unknown): Appearance | null {
  if (!Array.isArray(rows) || rows.length !== 3 || !rows.every(Array.isArray)) return null;
  if (rows[0][0] !== "Kunci" || rows[0][1] !== "Nilai" || rows[1][0] !== "nama_aplikasi" || rows[2][0] !== "warna_utama") return null;
  return validateAppearance(rows[1][1], rows[2][1]);
}
export function sameAppearance(a: Appearance, b: Appearance): boolean {
  return a.name === b.name && a.theme === b.theme;
}
