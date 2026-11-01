import type { Metadata } from "next";
import { AvisoBeta, EtiquetaBeta } from "@/components/Beta";
import { Cobranzas } from "@/components/inversores/Cobranzas";
import { requireRuta } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cobranzas" };

export default async function PaginaCobranzas({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/inversores/cobranzas`);

  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Inversores</span>
          <h1>
            Cobranzas <EtiquetaBeta />
          </h1>
          <p>Lo vencido de cada inversor actualizado por CAC, lo que vence este mes y el próximo, el aviso por WhatsApp y el seguimiento.</p>
        </div>
      </div>
      <Cobranzas />
    </main>
  );
}
