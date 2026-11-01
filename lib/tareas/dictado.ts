/**
 * Una tarea dictada: lo que alguien dijo ("mañana llamar a la constructora por el hormigón, que lo
 * haga Eliana, es urgente") se convierte en los campos de la tarea, para revisar antes de crearla.
 * Acá el esquema, las instrucciones y la limpieza de la respuesta. Puro.
 */

import { z } from "zod";
import { PRIORIDADES, RELACIONES, TIPOS, validarCambios, type CambiosTarea } from "./modelo";

export function esquemaDictado(equipo: string[]) {
  const personas = [...new Set(["", ...equipo.filter(Boolean)])] as [string, ...string[]];
  return z.object({
    titulo: z.string().describe("Qué hay que hacer, corto y con verbo (\"Llamar a la constructora por el hormigón\")."),
    descripcion: z.string().describe("Detalles y contexto que se dijeron y no entran en el título. Vacío si no hay."),
    responsable: z.enum(personas).describe("Quién la tiene que hacer, de la lista del equipo. Vacío si no se dijo."),
    vence: z.string().describe("Fecha AAAA-MM-DD si se dijo cuándo (\"mañana\", \"el jueves\", \"el 15\"), calculada desde hoy. Vacío si no se dijo."),
    hora: z.string().describe("Hora HH:MM si se dijo. Vacío si no."),
    prioridad: z.enum(PRIORIDADES).describe("Normal, salvo que se diga que es importante (Alta) o urgente / para ya (Urgente)."),
    tipo: z.enum(TIPOS),
    relacion: z.enum(RELACIONES).describe("Con quién tiene que ver: Inversor, Lead (un posible comprador), Proveedor, Unidad, o Interna."),
    con: z.string().describe("El nombre del inversor, lead o proveedor, o la unidad (\"2C\"), si se nombró. Vacío si no."),
    subtareas: z.array(z.string()).describe("Pasos sueltos que se enumeraron. Vacío si no hay."),
  });
}

export const INSTRUCCIONES_DICTADO = `Convertís una tarea dictada por voz en los campos de una tarea del hub de Mindlin Developers (una desarrolladora inmobiliaria de Buenos Aires).

- El texto viene de un dictado: puede tener errores de reconocimiento, muletillas o frases cortadas. Entendé la intención y escribí en castellano rioplatense correcto.
- Usá solo lo que se dijo. No inventes responsables, fechas, montos ni nombres.
- El responsable tiene que ser uno de la lista del equipo (por apodo o nombre parecido); si se nombra a alguien que no está, dejalo vacío y mencionalo en la descripción.
- Las fechas relativas se calculan desde la fecha de hoy que te pasan.
- Si el dictado tiene varias cosas para hacer, la principal va al título y el resto como subtareas.`;

/** El pedido para el modelo: el dictado, hoy y el equipo. */
export function pedidoDictado(texto: string, hoy: string, equipo: string[]): string {
  const dia = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${hoy}T12:00:00Z`));
  return `Hoy es ${dia} ${hoy}.\nEquipo: ${equipo.join(", ") || "(sin lista)"}.\n\nDictado:\n"""${texto}"""`;
}

/** La respuesta del modelo, pasada por las mismas reglas que una tarea cargada a mano. */
export function aCambios(r: z.infer<ReturnType<typeof esquemaDictado>>): CambiosTarea {
  const v = validarCambios(
    {
      titulo: r.titulo || "Tarea dictada",
      descripcion: r.descripcion,
      responsable: r.responsable,
      vence: /^\d{4}-\d{2}-\d{2}$/.test(r.vence) ? r.vence : null,
      hora: /^\d{1,2}:\d{2}$/.test(r.hora) ? r.hora : "",
      prioridad: r.prioridad,
      tipo: r.tipo,
      relacion: r.con ? r.relacion : "Interna",
      con: r.con,
      subtareas: r.subtareas.map((texto) => ({ texto, hecha: false })),
    },
    true,
  );
  return "cambios" in v ? v.cambios : { titulo: r.titulo || "Tarea dictada", descripcion: r.descripcion };
}

/** Sin IA (falta la clave o falló): la primera frase de título y todo el dictado de descripción. */
export function sinIa(texto: string): CambiosTarea {
  const limpio = texto.trim().replace(/\s+/g, " ");
  const primera = limpio.split(/(?<=[.!?])\s/)[0] ?? limpio;
  const titulo = primera.length > 90 ? `${primera.slice(0, 89)}…` : primera;
  return { titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1), descripcion: limpio === primera ? "" : limpio };
}
