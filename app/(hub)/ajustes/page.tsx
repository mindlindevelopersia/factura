import type { Metadata } from "next";
import { Ajustes } from "@/components/ajustes/Ajustes";
import { requireRuta } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ajustes" };

export default async function PaginaAjustes() {
  await requireRuta("/ajustes");
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Mindlin Developers</span>
          <h1>Ajustes</h1>
          <p>Los usuarios: sus datos, su @usuario para mencionarlos, su rol y qué módulos y proyectos ve. Y los roles, con lo que ve cada uno de entrada.</p>
        </div>
      </div>
      <Ajustes />
    </main>
  );
}
