import type { Metadata } from "next";
import { EtiquetaBeta } from "@/components/Beta";
import { Ideas } from "@/components/producto/Ideas";
import { requireRuta } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ideas" };

export default async function PaginaIdeas() {
  await requireRuta("/producto/ideas");
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">HQ · Producto</span>
          <h1>
            Ideas <EtiquetaBeta />
          </h1>
          <p>Tirá ideas para el hub: título y descripción, y el resto comenta (con @ le avisás a alguien). Las que van, pasan a Features.</p>
        </div>
      </div>
      <Ideas />
    </main>
  );
}
