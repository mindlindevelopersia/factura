import type { Metadata } from "next";
import { Suspense } from "react";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { Egresos } from "@/components/finanzas/Egresos";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Egresos" };

export default async function PaginaEgresos() {
  await requireUser();

  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Finanzas</span>
          <h1>
            Egresos <EtiquetaBeta />
          </h1>
          <p>Lo que se pagó, en pesos y en dólares, y en qué rubros. Sale de las pestañas de caja.</p>
        </div>
      </div>
      <Suspense>
        <Egresos />
      </Suspense>
    </main>
  );
}
