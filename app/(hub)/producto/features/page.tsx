import type { Metadata } from "next";
import { EtiquetaBeta } from "@/components/Beta";
import { Tareas } from "@/components/tareas/Tareas";
import { requireRuta } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Features" };

export default async function PaginaFeatures() {
  await requireRuta("/producto/features");
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">HQ · Producto</span>
          <h1>
            Features <EtiquetaBeta />
          </h1>
          <p>Lo que hay que hacer en el hub, como un kanban: por hacer, en curso, bloqueado y hecho, con responsable, subtareas y comentarios.</p>
        </div>
      </div>
      <Tareas modo="producto" />
    </main>
  );
}
