/**
 * El buscador del hub (⌘K): busca en todo a la vez (páginas, leads, propuestas, unidades,
 * inversores, cobros, tareas, desarrolladores) y devuelve una lista con la etiqueta de qué es cada
 * resultado. Las páginas se arman acá mismo; el resto llega de /api/buscar. Todo puro (sin red).
 */

import { AREAS_EMPRESA, areasDeProyecto, PROYECTOS, rutaProyecto, SECCIONES_DE_PROYECTO, SOCIOS } from "../modulos";

export type TipoResultado = "Página" | "Lead" | "Propuesta" | "Unidad" | "Inversor" | "Cobro" | "Tarea" | "Desarrollador";

export interface Resultado {
  tipo: TipoResultado;
  /** La etiqueta que se muestra (para las páginas, el área: "Indicadores", "Lerma 439 · Comercial"). */
  etiqueta: string;
  titulo: string;
  detalle: string;
  href: string;
  /** El proyecto ("" si es de la empresa): los del proyecto en el que estás salen primero. */
  proyecto: string;
  /** Texto extra donde también se busca (teléfono, mail, inversor de una unidad…). */
  extra?: string;
}

export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Las páginas del hub: las áreas y módulos de la empresa y de cada proyecto activo, y los desarrolladores. */
export function paginas(): Resultado[] {
  const r: Resultado[] = [{ tipo: "Página", etiqueta: "Inicio", titulo: "Inicio", detalle: "El dólar del día y los proyectos", href: "/", proyecto: "" }];
  for (const a of AREAS_EMPRESA) {
    r.push({ tipo: "Página", etiqueta: a.nombre, titulo: a.nombre, detalle: a.descripcion, href: a.href, proyecto: "" });
    for (const m of a.modulos) r.push({ tipo: "Página", etiqueta: a.nombre, titulo: m.nombre, detalle: m.descripcion, href: m.href, proyecto: "" });
  }
  for (const p of PROYECTOS.filter((x) => x.estado === "activo")) {
    r.push({ tipo: "Página", etiqueta: "Proyecto", titulo: p.nombre, detalle: p.descripcion, href: rutaProyecto(p.id), proyecto: p.id });
    for (const a of areasDeProyecto(p.id)) {
      r.push({ tipo: "Página", etiqueta: p.nombre, titulo: a.nombre, detalle: a.descripcion, href: a.href, proyecto: p.id });
      for (const m of a.modulos) r.push({ tipo: "Página", etiqueta: `${p.nombre} · ${a.nombre}`, titulo: m.nombre, detalle: m.descripcion, href: m.href, proyecto: p.id });
    }
    for (const s of SECCIONES_DE_PROYECTO) r.push({ tipo: "Página", etiqueta: `${p.nombre} · CRM`, titulo: s.nombre, detalle: "", href: rutaProyecto(p.id, s.sub), proyecto: p.id });
    if (p.management) {
      for (const s of SOCIOS) {
        r.push({ tipo: "Desarrollador", etiqueta: "Desarrollador", titulo: s.nombre, detalle: `${p.nombre} · ${Math.round(s.parte * 100)}% de lo de los desarrolladores`, href: rutaProyecto(p.id, "management/desarrolladores"), proyecto: p.id });
      }
    }
  }
  return r;
}

/**
 * Los resultados para lo que se escribió: cada palabra tiene que aparecer (sin importar tildes ni
 * mayúsculas). Primero lo que empieza igual, después lo que tiene una palabra que empieza igual;
 * los del proyecto actual antes que los de otros.
 */
export function buscar(items: Resultado[], q: string, proyectoActual = "", max = 30): Resultado[] {
  const palabras = normalizar(q).split(" ").filter(Boolean);
  if (!palabras.length) return [];
  const puntuados: { r: Resultado; p: number }[] = [];
  for (const r of items) {
    const titulo = normalizar(r.titulo);
    const todo = `${titulo} ${normalizar(r.detalle)} ${normalizar(r.etiqueta)} ${normalizar(r.extra ?? "")}`;
    if (!palabras.every((w) => todo.includes(w))) continue;
    const frase = palabras.join(" ");
    let p = 0;
    if (titulo === frase) p += 100;
    else if (titulo.startsWith(frase)) p += 60;
    else if (palabras.every((w) => titulo.split(/[\s·,.-]+/).some((x) => x.startsWith(w)))) p += 40;
    else if (palabras.every((w) => titulo.includes(w))) p += 20;
    if (proyectoActual && r.proyecto === proyectoActual) p += 8;
    if (r.tipo === "Página") p += 3;
    puntuados.push({ r, p });
  }
  return puntuados
    .sort((a, b) => b.p - a.p || a.r.titulo.localeCompare(b.r.titulo))
    .slice(0, max)
    .map((x) => x.r);
}
