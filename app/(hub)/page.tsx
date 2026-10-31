import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TarjetasModulos } from "@/components/TarjetasModulos";
import { AREAS, RUTA_FACTURAS } from "@/lib/modulos";

export const metadata: Metadata = { title: "Inicio" };

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ revisar?: string }>;
}) {
  // Los avisos de Telegram anteriores al hub apuntan a /?revisar=<id>: siguen abriendo la factura.
  const { revisar } = await searchParams;
  if (revisar) redirect(`${RUTA_FACTURAS}?revisar=${encodeURIComponent(revisar)}`);

  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Mindlin Developers</span>
          <h1>Hub de la empresa</h1>
          <p>Elegí un área para empezar.</p>
        </div>
      </div>
      <TarjetasModulos items={AREAS} />
    </main>
  );
}
