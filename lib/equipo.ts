/**
 * Quién es quién en el hub: el nombre con el que se saluda a cada persona del equipo. El que no está
 * en la lista se saluda con el primer nombre de su cuenta de Google.
 */

export interface Persona {
  nombre: string;
  /** Cómo se lo saluda. */
  apodo: string;
  rol?: string;
}

const EQUIPO: Record<string, Persona> = {
  "matimindlin111@gmail.com": { nombre: "Matías Mindlin", apodo: "Mati", rol: "CEO" },
  "mindlindevops@gmail.com": { nombre: "Tadeo Ferrer", apodo: "Tade" },
};

/** Los apodos del equipo, para elegir responsable. */
export const EQUIPO_APODOS = Object.values(EQUIPO).map((p) => p.apodo);

export function persona(email: string, nombreCuenta?: string | null): Persona {
  const p = EQUIPO[email.trim().toLowerCase()];
  if (p) return p;
  const primero = nombreCuenta && !nombreCuenta.includes("@") ? nombreCuenta.trim().split(/\s+/)[0] : null;
  return { nombre: nombreCuenta || email, apodo: primero || email.split("@")[0] };
}

/** "Buenos días" de 5 a 12, "Buenas tardes" de 13 a 19, "Buenas noches" el resto (hora de Buenos Aires). */
export function saludoDelMomento(ahora = new Date()): string {
  const hora = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", hourCycle: "h23" }).format(ahora));
  if (hora >= 5 && hora < 13) return "Buenos días";
  if (hora >= 13 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}
