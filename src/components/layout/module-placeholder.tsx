import Link from "next/link";
import { ArrowRight, Construction } from "lucide-react";

export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="module-page">
      <div className="module-breadcrumb">
        MANAJEMEN DATA <span>/</span> {title.toUpperCase()}
      </div>
      <section className="module-card">
        <div className="module-icon">
          <Construction aria-hidden="true" size={28} />
        </div>
        <span className="module-status">DALAM PENGEMBANGAN</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <p>
          Modul ini sedang disiapkan. Pengelolaan data belum tersedia pada tahap
          ini.
        </p>
        <Link href="/dashboard/operasional" className="module-back">
          Kembali ke dashboard <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
