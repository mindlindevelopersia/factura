import { Icono } from "../Icono";

/** "¿De dónde sale?": de qué planilla, pestaña y columna sale un número, para poder revisarlo. */
export function Origen({ texto, marca }: { texto: string; marca?: "por-confirmar" | "conflicto" }) {
  return (
    <details className={`origen${marca ? ` origen--${marca}` : ""}`}>
      <summary>
        <Icono nombre={marca ? "alerta" : "ayuda"} size={12} />
        {marca === "por-confirmar" ? "Supuesto, a confirmar" : marca === "conflicto" ? "Revisar" : "¿De dónde sale?"}
      </summary>
      <span>{texto}</span>
    </details>
  );
}
