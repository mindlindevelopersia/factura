import type { Metadata } from "next";
import { TarjetasModulos } from "@/components/TarjetasModulos";
import { requireRuta } from "@/lib/auth/session";
import { IDEA_MARKETING } from "@/lib/marketing/ideas";
import { AREAS_EMPRESA } from "@/lib/modulos";

export const metadata: Metadata = { title: "Marketing" };

const area = AREAS_EMPRESA.find((a) => a.href === "/marketing")!;

export default async function Marketing() {
  await requireRuta("/marketing");
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">HQ</span>
          <h1>Marketing</h1>
          <p>{IDEA_MARKETING.resumen}</p>
        </div>
      </div>
      <section className="idea-mk__principios" aria-label="Cómo lo pensamos">
        <h2>Cómo lo pensamos</h2>
        <ul>
          {IDEA_MARKETING.principios.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
      <TarjetasModulos items={area.modulos} />
    </main>
  );
}
