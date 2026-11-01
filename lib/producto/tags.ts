/**
 * Los tags de las ideas: el área (y, si se quiere, el módulo) del hub a la que aplican. Salen de
 * lib/modulos (las áreas de HQ y las de cada proyecto), más dos generales. Se guardan como texto
 * legible ("Marketing", "Marketing · Blog") separados por coma. Puro, sirve en el navegador.
 */

import { AREAS_EMPRESA, areasDeProyecto, PROYECTO_PRINCIPAL } from "../modulos";

export interface GrupoTags {
  area: string;
  modulos: string[];
}

export const SEP_TAG = " · ";

const desdeModulos: GrupoTags[] = [...AREAS_EMPRESA, ...areasDeProyecto(PROYECTO_PRINCIPAL.id)].map((a) => ({ area: a.nombre, modulos: a.modulos.map((m) => m.nombre) }));

/** Las áreas (sin repetir: Prefactibilidad está en HQ y en cada proyecto) con sus módulos. */
export const GRUPOS_TAGS: GrupoTags[] = [
  ...desdeModulos.filter((g, i) => desdeModulos.findIndex((x) => x.area === g.area) === i),
  { area: "Hub en general", modulos: ["Buscador", "Notificaciones", "Menú y navegación"] },
  { area: "Ajustes", modulos: ["Usuarios", "Roles y permisos"] },
];

export const TODOS_LOS_TAGS: string[] = GRUPOS_TAGS.flatMap((g) => [g.area, ...g.modulos.map((m) => `${g.area}${SEP_TAG}${m}`)]);

/** El área de un tag ("Marketing · Blog" → "Marketing"). */
export const areaDeTag = (t: string) => t.split(SEP_TAG)[0];

/** Deja solo tags conocidos, sin repetir y en el orden del menú. */
export function limpiarTags(x: unknown): string[] {
  const lista = Array.isArray(x) ? x : typeof x === "string" ? x.split(",") : [];
  const pedidos = new Set(lista.filter((t): t is string => typeof t === "string").map((t) => t.trim()));
  return TODOS_LOS_TAGS.filter((t) => pedidos.has(t));
}

export const tagsAFila = (tags: string[]) => tags.join(", ");
export const tagsDeFila = (s: string | undefined) => limpiarTags(s ?? "");

/** Si la idea es de esa área (por el área o por alguno de sus módulos). */
export const esDelArea = (tags: string[], area: string) => tags.some((t) => areaDeTag(t) === area);
