import type { Metadata } from "next";
import { Suspense } from "react";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { Ingresos } from "@/components/finanzas/Ingresos";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ingresos" };

export default async function PaginaIngresos() {
  await requireUser();

  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Finanzas</span>
          <h1>
            Ingresos <EtiquetaBeta />
          </h1>
          <p>Lo cobrado y lo que falta cobrar de los inversores de Lerma. Sale de la pestaña &quot;Flujo de fondos LERMA&quot;.</p>
        </div>
      </div>
      <Suspense>
        <Ingresos />
      </Suspense>
    </main>
  );
}
