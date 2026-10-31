import { notFound } from "next/navigation";
import { Icono } from "@/components/Icono";
import { proyecto as buscar } from "@/lib/modulos";

/** Todo lo de un proyecto. Uno desconocido no existe; uno bloqueado todavía no se puede abrir. */
export default async function LayoutProyecto({ children, params }: { children: React.ReactNode; params: Promise<{ proyecto: string }> }) {
  const { proyecto: id } = await params;
  const p = buscar(id);
  if (!p) notFound();
  if (p.estado === "bloqueado") {
    return (
      <main className="app-main" id="contenido">
        <div className="pagina-encabezado">
          <div>
            <span className="eyebrow">Proyecto · {p.vehiculo}</span>
            <h1>{p.nombre}</h1>
            <p>{p.descripcion}</p>
          </div>
        </div>
        <div className="area-vacia">
          <Icono nombre="ensayo" size={22} />
          <strong>Este proyecto todavía está en preparación</strong>
          <p>Cuando estén sus planillas y se respondan las preguntas para darlo de alta, se abren sus módulos.</p>
        </div>
      </main>
    );
  }
  return children;
}
