import type { Metadata } from "next";
import { EtiquetaBeta } from "@/components/Beta";
import { PrefactibilidadDelProyecto } from "@/components/prefactibilidad/Prefactibilidad";
import { requireRuta } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Prefactibilidad" };

export default async function Pagina({ params }: { params: Promise<{ proyecto: string }> }) {
  const { proyecto } = await params;
  await requireRuta(`/proyectos/${proyecto}/prefactibilidad`);
  const p = buscar(proyecto)!;
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">{p.nombre}</span>
          <h1>
            Prefactibilidad <EtiquetaBeta />
          </h1>
          <p>Lote, normativa y superficies construibles y vendibles del proyecto. Es la misma que en HQ → Prefactibilidad: se edita desde los dos lados.</p>
        </div>
      </div>
      <PrefactibilidadDelProyecto proyecto={proyecto} />
    </main>
  );
}
