import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { Panorama } from "@/components/indicadores/Panorama";
import { TarjetasModulos } from "@/components/TarjetasModulos";
import { requireUser } from "@/lib/auth/session";
import { AREAS } from "@/lib/modulos";

export const metadata: Metadata = { title: "Indicadores" };

const area = AREAS.find((a) => a.href === "/indicadores")!;

/** El inicio de Indicadores: el Panorama y los módulos del área. */
export default async function Indicadores() {
  await requireUser();

  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Área</span>
          <h1>
            Indicadores <EtiquetaBeta />
          </h1>
          <p>{area.descripcion}</p>
        </div>
      </div>
      <Panorama />
      <h2 className="cac__titulo-seccion indicadores__modulos">Módulos</h2>
      <TarjetasModulos items={area.modulos} />
    </main>
  );
}
