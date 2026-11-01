import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { ListaPrecios } from "@/components/proyectos/ListaPrecios";
import { requireRuta } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Lista de precios" };

export default async function Pagina({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/comercial/lista-de-precios`);
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
            Lista de precios <EtiquetaBeta />
          </h1>
          <p>La lista vigente de lo que falta vender y un simulador para decidir cuándo subirla.</p>
        </div>
      </div>
      <ListaPrecios />
    </main>
  );
}
