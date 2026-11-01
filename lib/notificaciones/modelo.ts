/**
 * Las notificaciones (la campanita de arriba a la derecha).
 *
 * - Guardadas (pestaña "Notificaciones" de la planilla del CRM): cuando alguien te menciona con
 *   @ (en una tarea, un comentario, una nota del CRM, la agenda), te asigna algo o comenta en tu tarea.
 * - Calculadas en el momento: tus vencimientos de hoy y mañana (y lo atrasado): tareas, próximos
 *   pasos de tus leads, tu agenda y las propuestas que hiciste.
 *
 * Marcar como leída agrega una fila "Leída" con el ID: sirve igual para las guardadas y las calculadas.
 * Todo puro (sin red).
 */

import type { Contacto } from "../crm/modelo";
import type { EventoAgenda } from "../calendario/eventos";
import { rutaProyecto, PROYECTO_PRINCIPAL } from "../modulos";
import type { PropuestaGuardada } from "../proyectos/propuestasGuardadas";
import { abierta, type Tarea } from "../tareas/modelo";

export type TipoNotificacion = "mencion" | "asignacion" | "comentario" | "vencimiento";

export interface Notificacion {
  id: string;
  /** Mail de quien la recibe. */
  para: string;
  /** ISO. */
  fecha: string;
  tipo: TipoNotificacion;
  titulo: string;
  texto: string;
  /** Adónde lleva ("/proyectos/lerma-439/tareas?tarea=…"). */
  link: string;
  /** Quién la generó (apodo), "" si es del sistema. */
  de: string;
  leida: boolean;
}

export interface Usuario {
  email: string;
  apodo: string;
  nombre: string;
  /** Otros nombres con los que se lo encuentra (el apodo de siempre si en Ajustes se le puso otro @usuario). */
  alias?: string[];
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const nombresDe = (u: Usuario) => [u.apodo, ...(u.alias ?? []), u.email.split("@")[0]].map(sinTildes);

export const COLUMNAS_NOTIFICACIONES = ["ID", "Para", "Fecha", "Tipo", "Título", "Texto", "Link", "De"] as const;

/** Las filas de tipo "leida" marcan como leída la notificación con ese ID. */
export const filaDeNotificacion = (n: Omit<Notificacion, "leida">) => [n.id, n.para, n.fecha, n.tipo, n.titulo, n.texto, n.link, n.de];
export const filaLeida = (id: string, para: string, fecha: string) => [id, para, fecha, "leida", "", "", "", ""];

/** Las notificaciones guardadas de un mail y los IDs que marcó como leídos. */
export function leerFilas(filas: string[][], para: string): { guardadas: Notificacion[]; leidas: Set<string> } {
  const mias = filas.filter((f) => (f[1] ?? "").toLowerCase() === para.toLowerCase() && f[0]);
  const leidas = new Set(mias.filter((f) => f[3] === "leida").map((f) => f[0]));
  const guardadas = mias
    .filter((f) => f[3] !== "leida")
    .map((f) => ({ id: f[0], para: f[1], fecha: f[2] ?? "", tipo: (f[3] || "mencion") as TipoNotificacion, titulo: f[4] ?? "", texto: f[5] ?? "", link: f[6] ?? "", de: f[7] ?? "", leida: false }));
  return { guardadas, leidas };
}


/** Los usuarios mencionados con @ en un texto (por apodo o por la parte del mail antes de la @). */
export function menciones(texto: string, usuarios: Usuario[]): Usuario[] {
  const nombres = [...texto.matchAll(/(?:^|[^\w@.])@([\p{L}\d._-]+)/gu)].map((m) => sinTildes(m[1]).replace(/[._-]+$/, ""));
  return usuarios.filter((u) => nombres.some((n) => nombresDe(u).includes(n)));
}

/** Los mencionados en el texto nuevo que no estaban en el anterior (para no avisar dos veces al editar). */
export function mencionesNuevas(antes: string, despues: string, usuarios: Usuario[]): Usuario[] {
  const ya = new Set(menciones(antes, usuarios).map((u) => u.email));
  return menciones(despues, usuarios).filter((u) => !ya.has(u.email));
}

/** El usuario con ese apodo (el responsable de una tarea o de un lead). */
export const usuarioPorApodo = (apodo: string, usuarios: Usuario[]) => (apodo ? usuarios.find((u) => nombresDe(u).includes(sinTildes(apodo))) : undefined);

/** Un pedacito del texto para la notificación. */
export const extracto = (t: string, max = 140) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const sumarDias = (f: string, n: number) => {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const cuando = (f: string, hoy: string) => (f < hoy ? `venció el ${f.split("-").reverse().join("/")}` : f === hoy ? "vence hoy" : "vence mañana");

/** Tus vencimientos de hoy, mañana y lo atrasado (los de los últimos 30 días, para no arrastrar lo viejo). */
export function vencimientosDe(
  apodo: string,
  datos: { tareas: Tarea[]; contactos: Contacto[]; agenda: EventoAgenda[]; propuestas: PropuestaGuardada[] },
  hoy: string,
): Notificacion[] {
  const manana = sumarDias(hoy, 1);
  const desde = sumarDias(hoy, -30);
  const toca = (f: string | null | undefined): f is string => !!f && f >= desde && f <= manana;
  const yo = sinTildes(apodo);
  const r: Notificacion[] = [];
  const base = { para: "", de: "", leida: false, tipo: "vencimiento" as const };
  for (const t of datos.tareas) {
    if (!abierta(t) || sinTildes(t.responsable) !== yo || !toca(t.vence)) continue;
    r.push({ ...base, id: `venc-tarea-${t.id}-${t.vence}`, fecha: `${t.vence}T00:00:00.000Z`, titulo: `Tarea: ${t.titulo}`, texto: `${cuando(t.vence, hoy)}${t.hora ? ` a las ${t.hora}` : ""}${t.con ? ` · ${t.con}` : ""}`, link: `${rutaProyecto(t.proyecto || PROYECTO_PRINCIPAL.id, "tareas")}?tarea=${t.id}` });
  }
  for (const c of datos.contactos) {
    const f = c.proximaFecha?.slice(0, 10);
    const abiertoLead = c.etapa !== "Vendido" && c.etapa !== "Perdido" && c.etapa !== "Dormido";
    if (!abiertoLead || sinTildes(c.responsable) !== yo || !toca(f)) continue;
    r.push({ ...base, id: `venc-lead-${c.id}-${f}`, fecha: `${f}T00:00:00.000Z`, titulo: `Hablar con ${c.nombre}`, texto: `${c.proximoPaso || "Seguimiento"} · ${f < hoy ? "atrasado" : f === hoy ? "hoy" : "mañana"}`, link: `${rutaProyecto(c.proyectos[0] ?? PROYECTO_PRINCIPAL.id, "comercial/crm")}?contacto=${c.id}` });
  }
  for (const e of datos.agenda) {
    if (sinTildes(e.responsable) !== yo || !toca(e.fecha) || e.fecha < hoy) continue;
    r.push({ ...base, id: `venc-agenda-${e.id}`, fecha: `${e.fecha}T00:00:00.000Z`, titulo: e.titulo, texto: `${e.fecha === hoy ? "Hoy" : "Mañana"}${e.hora ? ` a las ${e.hora}` : ""} · ${e.categoria}${e.detalle ? ` · ${extracto(e.detalle, 80)}` : ""}`, link: rutaProyecto(e.proyecto, "calendario") });
  }
  for (const p of datos.propuestas) {
    if (sinTildes(p.autor) !== yo || !toca(p.vence) || p.vence < hoy) continue;
    r.push({ ...base, id: `venc-propuesta-${p.id}`, fecha: `${p.vence}T00:00:00.000Z`, titulo: `Propuesta UF ${p.unidad}${p.cliente ? ` · ${p.cliente}` : ""}`, texto: p.vence === hoy ? "Vence hoy: ¿hacemos el seguimiento?" : "Vence mañana", link: `${rutaProyecto(p.proyecto, "comercial/propuesta")}?id=${p.id}&${p.parametros}${p.contactoId ? `&contacto=${p.contactoId}` : ""}` });
  }
  return r;
}

/** Todas juntas, de la más nueva a la más vieja, con las leídas marcadas. */
export function combinar(guardadas: Notificacion[], calculadas: Notificacion[], leidas: Set<string>): Notificacion[] {
  return [...guardadas, ...calculadas].map((n) => ({ ...n, leida: leidas.has(n.id) })).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
