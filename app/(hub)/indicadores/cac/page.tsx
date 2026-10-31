import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { IndiceCac } from "@/components/indicadores/IndiceCac";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Índice CAC" };

export default async function PaginaCac() {
  await requireUser();

  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Indicadores</span>
          <h1>
            Índice CAC <EtiquetaBeta />
          </h1>
          <p>Variación del costo de un edificio tipo en Capital Federal (Cámara Argentina de la Construcción, base 100 = dic. 2014).</p>
        </div>
      </div>
      <IndiceCac />
    </main>
  );
}
