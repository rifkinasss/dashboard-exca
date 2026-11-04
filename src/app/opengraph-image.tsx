import { ImageResponse } from "next/og";

export const alt = "Excavator Management System — Dashboard Monitoring Petak, Solar, dan Keuangan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#fff7f1", color: "#172033", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", position: "absolute", left: 72, top: 64, alignItems: "center", gap: 12, color: "#c34b0a", fontSize: 22, fontWeight: 700, letterSpacing: 3 }}>
        EXCAVATOR <span style={{ color: "#edb38d" }}>/</span> MANAGEMENT SYSTEM
      </div>
      <div style={{ display: "flex", position: "absolute", left: 72, top: 166, flexDirection: "column" }}>
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, color: "#b45321" }}>DASHBOARD MONITORING</span>
        <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.1 }}>PETAK <span style={{ color: "#e75106" }}>&amp; SOLAR</span></span>
        <span style={{ marginTop: 24, fontSize: 27, color: "#52627a" }}>Operasional excavator &amp; keuangan petak</span>
        <div style={{ display: "flex", gap: 14, marginTop: 32 }}>
          {['Produktivitas alat', 'Konsumsi solar', 'Keuangan'].map((label) => <span key={label} style={{ border: "1px solid #f6c6a8", borderRadius: 30, padding: "10px 17px", color: "#a54313", fontSize: 19, background: "#fff" }}>{label}</span>)}
        </div>
      </div>
      <div style={{ display: "flex", position: "absolute", bottom: 0, width: "100%", height: 102, background: "#f6c5a1", borderTop: "8px solid #eaa673" }} />
      <svg width="330" height="225" viewBox="0 0 260 160" style={{ position: "absolute", right: 65, bottom: 49 }}>
        <g stroke="#633117" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
          <path d="M52 116h89l12 12H43z" fill="#D85B12" /><path d="M53 82h57l10 35H49z" fill="#F9781B" />
          <path d="M99 58h33l19 59h-52z" fill="#FFAA38" /><path d="M105 64h22l10 31h-32z" fill="#DDF0F1" />
          <path d="M132 63l35-34 9 8-30 42z" fill="#F88619" /><path d="M169 29l40-19 7 8-40 20z" fill="#FFAA38" />
          <path d="M210 13l8 4 5 61-8 1z" fill="#F88619" /><path d="M215 78l10-2 14 17-4 14-18-3-7-12z" fill="#475458" />
          <rect x="37" y="124" width="123" height="19" rx="9.5" fill="#374047" /><path d="M49 134h100" stroke="#E9C6A7" strokeWidth="4" strokeDasharray="7 7" />
        </g>
      </svg>
      <span style={{ position: "absolute", left: 72, bottom: 39, color: "#87401f", fontSize: 19, fontWeight: 700 }}>EXCAVATOR MANAGEMENT SYSTEM · NASLABS</span>
    </div>,
    size,
  );
}
