/**
 * La memoria de la conversación del bot: lo que dijo la persona y lo que contestó el bot (con lo
 * que hizo), por chat. Se olvida después de un rato sin hablar. Solo texto: las llamadas a las
 * herramientas no se guardan (lo hecho queda anotado en la respuesta). Puro.
 */

export interface Turno {
  rol: "user" | "assistant";
  texto: string;
}

/** Sin hablar más de esto, arranca de cero. */
export const OLVIDA_MS = 2 * 60 * 60 * 1000;
const MAX_TURNOS = 20;
const MAX_CARACTERES = 16_000;

export const vigente = (actualizada: string | null | undefined, ahoraMs: number) => !!actualizada && ahoraMs - Date.parse(actualizada) < OLVIDA_MS;

/** Los últimos turnos que entran, empezando siempre por uno de la persona. */
export function recortar(turnos: Turno[]): Turno[] {
  const r: Turno[] = [];
  let total = 0;
  for (let i = turnos.length - 1; i >= 0 && r.length < MAX_TURNOS; i--) {
    total += turnos[i].texto.length;
    if (total > MAX_CARACTERES) break;
    r.unshift(turnos[i]);
  }
  while (r.length && r[0].rol !== "user") r.shift();
  return r;
}

/** Lo que el bot contestó, con lo que hizo al final (para poder decir "cambiale la fecha"). */
export const turnoBot = (respuesta: string, acciones: string[]): Turno => ({ rol: "assistant", texto: acciones.length ? `${respuesta}\n[Hecho: ${acciones.join("; ")}]` : respuesta });

export function leerTurnos(json: string | undefined): Turno[] {
  try {
    const x = JSON.parse(json ?? "[]");
    return Array.isArray(x) ? x.filter((t): t is Turno => (t?.rol === "user" || t?.rol === "assistant") && typeof t?.texto === "string") : [];
  } catch {
    return [];
  }
}
