import type { Metadata } from "next";
import { Bandeja } from "@/components/Bandeja";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Facturas y comprobantes" };

export default async function Facturas({
  searchParams,
}: {
  searchParams: Promise<{ revisar?: string }>;
}) {
  await requireUser();
  const { revisar } = await searchParams;

  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Administración</span>
          <h1>Facturas y comprobantes</h1>
          <p>Revisá lo que llega. Aprobá con los datos a la vista.</p>
        </div>
        <div className="pagina-encabezado__ayuda">
          <span className="punto-estado" />
          Registro con aprobación manual
        </div>
      </div>
      <Bandeja revisar={revisar} inicial="inicio" />
    </main>
  );
}
