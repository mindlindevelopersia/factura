import type { Metadata } from "next";
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
      <div className="area-vacia">
        <strong>Todavía no hay módulos en Finanzas</strong>
        <p>Cuando se sume el primero, va a aparecer acá y en el menú de la izquierda.</p>
      </div>
    </main>
  );
}
