import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { Unidades } from "@/components/proyectos/Unidades";
import { requireRuta } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Unidades" };

export default async function Pagina({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/comercial/unidades`);
  const { proyecto } = await params;
  const p = buscar(proyecto)!;
  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">
            {p.nombre} · Comercial
          </span>
          <h1>
            Unidades <EtiquetaBeta />
          </h1>
          <p>Cada unidad con sus superficies, su estado y su precio, piso por piso. Sale de la lista de precios del Excel madre.</p>
        </div>
      </div>
      <Unidades />
    </main>
  );
}
