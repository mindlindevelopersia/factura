import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { Presupuesto } from "@/components/finanzas/Presupuesto";
import { requireRuta } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Presupuesto" };

export default async function PaginaPresupuesto({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/finanzas/presupuesto`);
  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Finanzas</span>
          <h1>
            Presupuesto <EtiquetaBeta />
          </h1>
          <p>El presupuesto de obra por rubro (base 0) contra lo que ya se pagó: cuánto falta, el costo final estimado y el costo del m².</p>
        </div>
      </div>
      <Presupuesto />
    </main>
  );
}
