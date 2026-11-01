import type { Metadata } from "next";
import { EtiquetaBeta } from "@/components/Beta";
import { Calendario } from "@/components/proyectos/Calendario";
import { requireUser } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Calendario" };

export default async function Pagina({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireUser();
  const { proyecto } = await params;
  const p = buscar(proyecto)!;
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">{p.nombre}</span>
          <h1>
            Calendario <EtiquetaBeta />
          </h1>
          <p>Todo lo que tiene fecha: cobros de los inversores, pagos, a qué lead hablarle, propuestas que vencen y lo que cargues a mano. Tocá un día para ver el detalle.</p>
        </div>
      </div>
      <Calendario />
    </main>
  );
}
