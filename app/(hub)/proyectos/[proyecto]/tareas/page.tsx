import type { Metadata } from "next";
import { EtiquetaBeta } from "@/components/Beta";
import { Tareas } from "@/components/tareas/Tareas";
import { requireRuta } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Tareas" };

export default async function Pagina({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/tareas`);
  const { proyecto } = await params;
  const p = buscar(proyecto)!;
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">{p.nombre}</span>
          <h1>
            Tareas <EtiquetaBeta />
          </h1>
          <p>Lo puntual: con un inversor, un proveedor, un lead o algo interno. Responsable, fecha, subtareas, comentarios y qué la bloquea. Las que tienen fecha aparecen en el Calendario.</p>
        </div>
      </div>
      <Tareas />
    </main>
  );
}
