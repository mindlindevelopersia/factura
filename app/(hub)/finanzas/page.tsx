import type { Metadata } from "next";
import { TarjetasModulos } from "@/components/TarjetasModulos";
import { AREAS } from "@/lib/modulos";

export const metadata: Metadata = { title: "Finanzas" };

const area = AREAS.find((a) => a.href === "/finanzas")!;

export default function Finanzas() {
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Área</span>
          <h1>{area.nombre}</h1>
          <p>{area.descripcion}</p>
        </div>
      </div>
      <TarjetasModulos items={area.modulos} />
    </main>
  );
}
