import type { Metadata } from "next";
import { AvisoBeta } from "@/components/Beta";
import { Tablero } from "@/components/proyectos/Tablero";
import { TarjetasModulos } from "@/components/TarjetasModulos";
import { requireUser } from "@/lib/auth/session";
import { areasDeProyecto, proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Proyecto" };

/** La portada de un proyecto: el tablero y sus áreas. */
export default async function PaginaProyecto({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireUser();
  const { proyecto: id } = await params;
  const p = buscar(id)!;
  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Proyecto · {p.vehiculo}</span>
          <h1>{p.nombre}</h1>
          <p>{p.descripcion}</p>
        </div>
      </div>
      {p.planillaMadre && <Tablero />}
      <h2 className="cac__titulo-seccion indicadores__modulos">Áreas del proyecto</h2>
      <TarjetasModulos items={areasDeProyecto(p.id)} />
    </main>
  );
}
