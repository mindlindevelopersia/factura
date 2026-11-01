import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { CrmEmbudo } from "@/components/crm/Crm";
import { requireUser } from "@/lib/auth/session";
import { proyecto as buscar } from "@/lib/modulos";

export const metadata: Metadata = { title: "CRM · Embudo" };

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
            CRM · Embudo <EtiquetaBeta />
          </h1>
          <p>Cada contacto en su etapa, con su temperatura y su próximo paso. Arrastrá para moverlo.</p>
        </div>
      </div>
      <CrmEmbudo />
    </main>
  );
}
