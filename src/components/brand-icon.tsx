export function BrandIcon({ size = 30, color }: { size?: number; color?: string }) {
  return <svg data-brand-icon viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ color: color ?? "var(--primary)" }}>
  <rect width="64" height="64" rx="16" fill="var(--primary-soft, #fff7ed)"/>
  <g stroke="#172033" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 46h36a5 5 0 0 1 0 10H11a5 5 0 0 1 0-10Z" fill="#263445" strokeWidth="2.5"/>
    <path d="M15 51h2m5 0h2m5 0h2m5 0h2m5 0h2" fill="none" stroke="#cbd5e1" strokeWidth="2"/>
    <path d="M12 36h15l4 10H10z" fill="currentColor" strokeWidth="2.5"/>
    <path d="M24 24h11l7 22H24z" fill="currentColor" strokeWidth="2.5"/>
    <path d="M28 28h5l3 9h-8z" fill="#dbeafe" strokeWidth="2"/>
    <path d="m37 27 12-12 4 3-12 15z" fill="currentColor" strokeWidth="2.5"/>
    <path d="m49 15 5-4 3 3-4 4" fill="currentColor" strokeWidth="2.5"/>
    <path d="m55 15 2 1 1 16-3 1z" fill="currentColor" strokeWidth="2.5"/>
    <path d="m55 32 4-1 3 6-2 5-5-1-3-4z" fill="#475569" strokeWidth="2.5"/>
  </g>
</svg>;
}
