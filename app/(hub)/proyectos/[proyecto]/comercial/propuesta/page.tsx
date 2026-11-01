import type { Metadata } from "next";
import { Suspense } from "react";
import { EtiquetaBeta } from "@/components/Beta";
import { Propuesta } from "@/components/proyectos/Propuesta";
import { Propuestas } from "@/components/proyectos/Propuestas";
import { requireRuta } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "Propuestas comerciales" };

/** Sin nada en la URL, la lista de propuestas; con datos (una nueva, una guardada o un link viejo), el editor. */
export default async function Pagina({ params, searchParams }: { params: Promise<{ proyecto: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/comercial/propuesta`);
  const { proyecto } = await params;
  const editar = Object.keys(await searchParams).length > 0;
  const p = buscar(proyecto)!;
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado solo-pantalla">
        <div>
          <span className="eyebrow">{p.nombre} · Comercial</span>
          <h1>
            {editar ? "Propuesta comercial" : "Propuestas comerciales"} <EtiquetaBeta />
          </h1>
          <p>
            {editar
              ? "Elegí la unidad y cómo paga: el valor al dólar MEP de hoy, partes A y B, anticipos, cuotas y refuerzos. Guardala para tenerla en la lista; sale con el plano y lista para mandar en PDF."
              : "Todas las propuestas guardadas: quién la hizo, para quién y hasta cuándo vale. Abrila para editarla, descargá el PDF o mandala por WhatsApp."}
          </p>
        </div>
      </div>
      <Suspense fallback={<p className="ficha__nota">Preparando…</p>}>{editar ? <Propuesta /> : <Propuestas />}</Suspense>
    </main>
  );
}
