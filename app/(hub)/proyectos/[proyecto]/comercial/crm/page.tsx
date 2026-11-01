import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { CrmDashboard } from "@/components/crm/Crm";
import { requireUser } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "CRM" };

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
            CRM <EtiquetaBeta />
          </h1>
          <p>Las alarmas de a quién hablarle, lo que vence esta semana y los números del embudo.</p>
        </div>
      </div>
      <CrmDashboard />
    </main>
  );
}
