import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { Cuentas } from "@/components/inversores/Cuentas";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cuentas corrientes" };

export default async function PaginaCuentas() {
  await requireUser();

  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Inversores</span>
          <h1>
            Cuentas corrientes <EtiquetaBeta />
          </h1>
          <p>Cuánto pagó cada inversor, cuánto le falta y cuándo. Sale de &quot;Pagos por Inversor&quot; y del Flujo de fondos.</p>
        </div>
      </div>
      <Cuentas />
    </main>
  );
}
