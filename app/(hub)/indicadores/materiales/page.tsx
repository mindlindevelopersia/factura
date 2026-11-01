import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { Materiales } from "@/components/indicadores/Materiales";
import { requireRuta } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Materiales" };

export default async function PaginaMateriales() {
  await requireRuta("/indicadores/materiales");

  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Indicadores</span>
          <h1>
            Materiales <EtiquetaBeta />
          </h1>
          <p>¿Es momento de comprar? Cada material de los precios medios de la Cámara contra su propia historia.</p>
        </div>
      </div>
      <Materiales />
    </main>
  );
}
