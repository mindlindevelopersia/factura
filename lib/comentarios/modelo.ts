/**
 * Comentarios en los números (como las notas de Excel): cualquiera deja una nota sobre un dato
 * ("esto lo hice así por tal cosa"), con @ para avisarle a alguien, y los demás responden abajo.
 *
 * Cada dato tiene una clave ("pf:<id>:gcba", "cf:lerma-439:obra") y vive en una página (la ruta):
 * quien no puede ver la página, no ve sus comentarios. Se guardan en la planilla del CRM, pestaña
 * "Comentarios en datos". Todo puro (sin red).
 */

export interface ComentarioDato {
  id: string;
  /** El dato: "pf:<id>:gcba". */
  clave: string;
  /** El comentario al que responde ("" si es el primero del hilo). */
  padre: string;
  fecha: string;
  usuario: string;
  texto: string;
  /** La página del dato ("/proyectos/lerma-439/prefactibilidad"), para el permiso y el link. */
  ruta: string;
  /** Qué es el dato, para leerlo fuera de la página ("Prefactibilidad Lerma 439 · Construible según GCBA"). */
  etiqueta: string;
}

export const COLUMNAS_COMENTARIOS_DATOS = ["ID", "Dato", "Responde a", "Fecha", "Usuario", "Comentario", "Página", "Qué es"] as const;

export const filaDeComentarioDato = (c: ComentarioDato) => [c.id, c.clave, c.padre, c.fecha, c.usuario, c.texto, c.ruta, c.etiqueta];
export const comentarioDatoDeFila = (f: string[]): ComentarioDato => ({ id: f[0] ?? "", clave: f[1] ?? "", padre: f[2] ?? "", fecha: f[3] ?? "", usuario: f[4] ?? "", texto: f[5] ?? "", ruta: f[6] ?? "", etiqueta: f[7] ?? "" });

/** La ruta sin lo que va después del "?" ni la barra final. */
export const rutaBase = (r: string) => (r.split("?")[0].replace(/\/+$/, "") || "/");

export function validarComentario(x: unknown): { error: string } | { datos: Omit<ComentarioDato, "id" | "fecha" | "usuario"> } {
  const o = (x ?? {}) as Record<string, unknown>;
  const s = (k: string, max: number) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, max) : "");
  const clave = s("clave", 200);
  const texto = s("texto", 3000);
  // La ruta puede traer "?id=…" (para que el aviso lleve justo ahí); el permiso y la búsqueda usan la base.
  const ruta = s("ruta", 300);
  if (!clave || !/^[\w:./-]+$/.test(clave)) return { error: "Dato inválido." };
  if (!texto) return { error: "El comentario está vacío." };
  if (!ruta.startsWith("/")) return { error: "Página inválida." };
  return { datos: { clave, padre: s("padre", 60), texto, ruta, etiqueta: s("etiqueta", 200) } };
}

export interface Hilo {
  raiz: ComentarioDato;
  respuestas: ComentarioDato[];
}

/** Los hilos de un dato: cada comentario inicial con sus respuestas, del más viejo al más nuevo. */
export function hilos(comentarios: ComentarioDato[], clave: string): Hilo[] {
  const delDato = comentarios.filter((c) => c.clave === clave).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const raices = delDato.filter((c) => !c.padre || !delDato.some((x) => x.id === c.padre));
  return raices.map((raiz) => ({ raiz, respuestas: delDato.filter((c) => c.padre === raiz.id) }));
}

/** Quiénes ya participan de un hilo (para avisarles de una respuesta). */
export const participantes = (h: Hilo) => [...new Set([h.raiz.usuario, ...h.respuestas.map((r) => r.usuario)].filter(Boolean))];
