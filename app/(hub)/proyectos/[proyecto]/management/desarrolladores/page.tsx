import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { Desarrolladores } from "@/components/proyectos/Desarrolladores";
import { requireRuta } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Desarrolladores" };

export default async function Pagina({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/management/desarrolladores`);
  const { proyecto } = await params;
  const p = buscar(proyecto)!;
  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">
            {p.nombre} · Management
          </span>
          <h1>
            Desarrolladores <EtiquetaBeta />
          </h1>
          <p>Los m² que se quedan los desarrolladores, a qué valor y cómo se reparten.</p>
        </div>
      </div>
      <Desarrolladores />
    </main>
  );
}
