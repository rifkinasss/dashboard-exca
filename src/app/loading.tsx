export default function Loading() {
  return <main className="route-state" role="status"><h1>Dashboard Monitoring Petak & Solar</h1><p>Menyiapkan data monitoring…</p><div className="loading-bars">{Array.from({ length: 5 }, (_, index) => <div key={index} />)}</div></main>;
}
