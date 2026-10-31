import type { Supuesto } from "@/lib/proyectos/comercial";
import { Icono } from "../Icono";

const TITULO: Record<Supuesto["tipo"], string> = { confirmado: "Confirmado", "por-confirmar": "A confirmar", conflicto: "No coincide" };

/** Los supuestos y conflictos de un proyecto, como tarjetas: qué se supuso, de dónde sale y qué falta confirmar. */
export function Supuestos({ supuestos, titulo = "Supuestos y datos a revisar" }: { supuestos: Supuesto[]; titulo?: string }) {
  if (!supuestos.length) return null;
  const abiertos = supuestos.filter((s) => s.tipo !== "confirmado").length;
  return (
    <details className="card supuestos" open={abiertos > 0 && abiertos <= 8}>
      <summary>
        <Icono nombre="alerta" size={18} />
        <strong>{titulo}</strong>
        <span className="supuestos__cuenta">
          {abiertos} para revisar · {supuestos.length - abiertos} confirmados
        </span>
      </summary>
      <ul className="supuestos__lista">
        {supuestos.map((s, i) => (
          <li key={i} className={`supuesto supuesto--${s.tipo}`}>
            <span className="supuesto__tipo">
              <Icono nombre={s.tipo === "confirmado" ? "check" : "alerta"} size={14} />
              {TITULO[s.tipo]}
            </span>
            <strong>{s.titulo}</strong>
            <p>{s.detalle}</p>
            {s.mientras && <p className="supuesto__mientras">Mientras tanto: {s.mientras}</p>}
            {s.origen && <p className="supuesto__origen">De dónde sale: {s.origen}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}
