import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { CashFlow } from "@/components/finanzas/CashFlow";
import { requireRuta } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cash flow" };

export default async function PaginaCashFlow({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/finanzas/cash-flow`);
  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Finanzas</span>
          <h1>
            Cash flow <EtiquetaBeta />
          </h1>
          <p>Lo que entra y lo que sale mes a mes: el proyectado del Excel madre, lo real (cobros y cajas) y real + proyectado para ver con qué caja se termina la obra.</p>
        </div>
      </div>
      <CashFlow />
    </main>
  );
}
