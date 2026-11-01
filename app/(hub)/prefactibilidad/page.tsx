import type { Metadata } from "next";
import { EtiquetaBeta } from "@/components/Beta";
import { Prefactibilidades } from "@/components/prefactibilidad/Prefactibilidad";
import { requireRuta } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Prefactibilidad" };

export default async function PaginaPrefactibilidad() {
  await requireRuta("/prefactibilidad");
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">HQ</span>
          <h1>
            Prefactibilidad <EtiquetaBeta />
          </h1>
          <p>El análisis de cada lote: normativa, superficies construibles (con el castigo de cada descubierta) y vendibles, con versiones y la carpeta de Drive. Cuando se compra, se asigna al proyecto y es la misma.</p>
        </div>
      </div>
      <Prefactibilidades />
    </main>
  );
}
