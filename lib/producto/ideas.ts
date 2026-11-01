/**
 * Producto · Ideas: un tablero de mensajes (como el de Basecamp). Cada idea tiene título,
 * descripción, quién la escribió y comentarios; las que van se pasan a Features (el kanban).
 * Se guardan en la planilla del CRM, pestañas "Producto Ideas" y "Producto Comentarios". Todo puro.
 */

import { limpiarTags, tagsAFila, tagsDeFila } from "./tags";

export const ESTADOS_IDEA = ["Abierta", "En features", "Descartada"] as const;
export type EstadoIdea = (typeof ESTADOS_IDEA)[number];

export interface Idea {
  id: string;
  titulo: string;
  texto: string;
  autor: string;
  creada: string;
  actualizada: string;
  estado: EstadoIdea;
  /** El feature que salió de esta idea. */
  featureId: string;
  /** Las áreas o módulos del hub a los que aplica ("Marketing", "Marketing · Blog"). */
  tags: string[];
}

export interface ComentarioIdea {
  ideaId: string;
  fecha: string;
  usuario: string;
  texto: string;
}

export const COLUMNAS_IDEAS = ["ID", "Título", "Descripción", "Escribió", "Creada", "Actualizada", "Estado", "Feature", "Tags"] as const;
export const COLUMNAS_COMENTARIOS_IDEAS = ["ID idea", "Fecha", "Usuario", "Comentario"] as const;

export const filaDeIdea = (i: Idea) => [i.id, i.titulo, i.texto, i.autor, i.creada, i.actualizada, i.estado, i.featureId, tagsAFila(i.tags)];
export const ideaDeFila = (f: string[]): Idea => ({
  id: f[0] ?? "",
  titulo: f[1] ?? "",
  texto: f[2] ?? "",
  autor: f[3] ?? "",
  creada: f[4] ?? "",
  actualizada: f[5] || f[4] || "",
  estado: (ESTADOS_IDEA as readonly string[]).includes(f[6] ?? "") ? (f[6] as EstadoIdea) : "Abierta",
  featureId: f[7] ?? "",
  tags: tagsDeFila(f[8]),
});
export const filaDeComentarioIdea = (c: ComentarioIdea) => [c.ideaId, c.fecha, c.usuario, c.texto];
export const comentarioIdeaDeFila = (f: string[]): ComentarioIdea => ({ ideaId: f[0] ?? "", fecha: f[1] ?? "", usuario: f[2] ?? "", texto: f[3] ?? "" });

/** Revisa lo que llega para crear o cambiar una idea. */
export function validarIdea(x: unknown, nueva: boolean): { error: string } | { cambios: Partial<Pick<Idea, "titulo" | "texto" | "estado" | "tags">> } {
  const o = (x ?? {}) as Record<string, unknown>;
  const c: Partial<Pick<Idea, "titulo" | "texto" | "estado" | "tags">> = {};
  if (o.tags !== undefined) c.tags = limpiarTags(o.tags);
  if (typeof o.titulo === "string") c.titulo = o.titulo.trim().slice(0, 200);
  if (typeof o.texto === "string") c.texto = o.texto.slice(0, 10000);
  if (typeof o.estado === "string") {
    if (!(ESTADOS_IDEA as readonly string[]).includes(o.estado)) return { error: "Estado inválido." };
    c.estado = o.estado as EstadoIdea;
  }
  if ((nueva || c.titulo !== undefined) && !c.titulo) return { error: "La idea necesita un título." };
  return { cambios: c };
}

/** Las más recientes primero (por la última actividad: la idea o su último comentario). */
export function ordenarIdeas(ideas: Idea[], comentarios: ComentarioIdea[]): Idea[] {
  const ultimo = new Map<string, string>();
  for (const c of comentarios) if (c.fecha > (ultimo.get(c.ideaId) ?? "")) ultimo.set(c.ideaId, c.fecha);
  const actividad = (i: Idea) => [i.actualizada, ultimo.get(i.id) ?? ""].sort().at(-1)!;
  return [...ideas].sort((a, b) => actividad(b).localeCompare(actividad(a)));
}
