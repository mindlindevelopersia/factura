import type { Metadata } from "next";
import { Suspense } from "react";
import { EtiquetaBeta } from "@/components/Beta";
import { Propuesta } from "@/components/proyectos/Propuesta";
import { requireUser } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Propuesta comercial" };

export default async function Pagina({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireUser();
  const { proyecto } = await params;
  const p = buscar(proyecto)!;
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado solo-pantalla">
        <div>
          <span className="eyebrow">{p.nombre} · Comercial</span>
          <h1>
            Propuesta comercial <EtiquetaBeta />
          </h1>
          <p>Elegí la unidad y cómo paga: el valor al dólar MEP de hoy, partes A y B, anticipos, cuotas y refuerzos. Sale con el plano y lista para mandar en PDF.</p>
        </div>
      </div>
      <Suspense fallback={<p className="ficha__nota">Preparando…</p>}>
        <Propuesta />
      </Suspense>
    </main>
  );
}
