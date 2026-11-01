import type { Metadata } from "next";
import { TarjetasModulos } from "@/components/TarjetasModulos";
import { requireRuta } from "@/lib/auth/session";
import { AREAS_EMPRESA } from "@/lib/modulos";

export const metadata: Metadata = { title: "Producto" };

const area = AREAS_EMPRESA.find((a) => a.href === "/producto")!;

export default async function Producto() {
  await requireRuta("/producto");
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">HQ</span>
          <h1>Producto</h1>
          <p>{area.descripcion}</p>
        </div>
      </div>
      <TarjetasModulos items={area.modulos} />
    </main>
  );
}
