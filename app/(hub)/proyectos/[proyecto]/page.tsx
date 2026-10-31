import type { Metadata } from "next";
import { TarjetasModulos } from "@/components/TarjetasModulos";
import { areasDeProyecto, proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Proyecto" };

/** La portada de un proyecto: sus áreas (el tablero comercial se suma acá). */
export default async function PaginaProyecto({ params }: { params: Promise<{ proyecto: string }> }) {
  const { proyecto: id } = await params;
  const p = buscar(id)!;
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Proyecto · {p.vehiculo}</span>
          <h1>{p.nombre}</h1>
          <p>{p.descripcion}</p>
        </div>
      </div>
      <TarjetasModulos items={areasDeProyecto(p.id)} />
    </main>
  );
}
