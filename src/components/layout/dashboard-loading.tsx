export function DashboardLoading({
  section = "operasional",
}: {
  section?: "operasional" | "keuangan";
}) {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <div className="loading-screen-inner">
        <div className="loading-brand">
          EXCAVATOR <span> / </span> MANAGEMENT SYSTEM
        </div>
        <div className="loading-scene" aria-hidden="true">
          <div className="loading-sun" />
          <div className="loading-hill loading-hill-back" />
          <div className="loading-hill loading-hill-front" />
          <svg
            className="loading-excavator"
            viewBox="0 0 260 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g
              className="loading-machine"
              stroke="#633117"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              <path d="M52 116h89l12 12H43z" fill="#D85B12" />
              <path d="M53 82h57l10 35H49z" fill="#F9781B" />
              <path d="M99 58h33l19 59h-52z" fill="#FFAA38" />
              <path d="M105 64h22l10 31h-32z" fill="#DDF0F1" />
              <path d="M110 68h14l5 15h-19z" fill="#8FBFC5" />
              <path d="M132 63l35-34 9 8-30 42z" fill="#F88619" />
              <path d="M169 29l40-19 7 8-40 20z" fill="#FFAA38" />
              <path d="M210 13l8 4 5 61-8 1z" fill="#F88619" />
              <path d="M215 78l10-2 14 17-4 14-18-3-7-12z" fill="#475458" />
              <path
                d="M176 29l29-14M218 25l3 46"
                stroke="#FFF1DB"
                strokeWidth="2"
              />
              <circle cx="172" cy="33" r="4" fill="#633117" />
              <rect
                x="37"
                y="124"
                width="123"
                height="19"
                rx="9.5"
                fill="#374047"
              />
              <path
                className="loading-track"
                d="M49 134h100"
                stroke="#E9C6A7"
                strokeWidth="4"
                strokeDasharray="7 7"
              />
              <path d="M60 97h27M60 103h18" stroke="#AD470D" strokeWidth="2" />
            </g>
          </svg>
          <div className="loading-ground">
            <div className="loading-ground-marks" />
          </div>
        </div>
        <div className="loading-copy">
          <span className="loading-eyebrow">
            DASHBOARD {section === "keuangan" ? "KEUANGAN" : "OPERASIONAL"}
          </span>
          <h1>Menyiapkan dashboard</h1>
          <p>
            Data {section === "keuangan" ? "keuangan" : "operasional"} sedang
            dimuat. Mohon tunggu sebentar.
          </p>
        </div>
        <div className="loading-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  );
}
