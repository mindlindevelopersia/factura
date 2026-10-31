import { Icono } from "./Icono";

/** Marca chica de "Beta", con un tubo de ensayo, para los módulos en prueba. */
export function EtiquetaBeta() {
  return (
    <span className="etiqueta-beta">
      <Icono nombre="ensayo" size={12} />
      Beta
    </span>
  );
}

/** Franja finita arriba de un módulo en prueba. */
export function AvisoBeta() {
  return (
    <p className="aviso-beta solo-pantalla" role="note">
      <Icono nombre="ensayo" size={16} />
      <strong>Beta</strong>
      <span>Este módulo está en prueba: revisá los números contra la planilla y avisá si ves algo raro.</span>
    </p>
  );
}
