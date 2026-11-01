import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { CrmContactos } from "@/components/crm/Crm";
import { requireUser } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "CRM · Base de datos" };

export default async function Pagina({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireUser();
  const { proyecto } = await params;
  const p = buscar(proyecto)!;
  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">{p.nombre} · Comercial</span>
          <h1>
            CRM · Base de datos <EtiquetaBeta />
          </h1>
          <p>Todos los contactos de la empresa, con búsqueda y filtros. Desde la ficha le escribís por WhatsApp o mail.</p>
        </div>
      </div>
      <CrmContactos />
    </main>
  );
}
