import type { Metadata } from "next";
import { Suspense } from "react";
import { Ingresos } from "@/components/finanzas/Ingresos";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ingresos" };

export default async function PaginaIngresos() {
  await requireUser();

  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Finanzas</span>
          <h1>Ingresos</h1>
          <p>Lo cobrado y lo que falta cobrar de los inversores de Lerma. Sale de la pestaña &quot;Flujo de fondos LERMA&quot;.</p>
        </div>
      </div>
      <Suspense>
        <Ingresos />
      </Suspense>
    </main>
  );
}
