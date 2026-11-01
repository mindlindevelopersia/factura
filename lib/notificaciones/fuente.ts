import "server-only";
import { allowedEmails } from "../auth/allowed";
import { leerAgenda } from "../calendario/fuente";
import { CrmSinConfigurar, leerCrm } from "../crm/fuente";
import { nuevoId } from "../crm/modelo";
import { persona } from "../equipo";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { hoyBuenosAires } from "../inversores/cobranzas";
import { PROYECTOS } from "../modulos";
import { leerPropuestas } from "../proyectos/propuestasFuente";
import { leerTareas } from "../tareas/fuente";
import {
  combinar,
  COLUMNAS_NOTIFICACIONES,
  extracto,
  filaDeNotificacion,
  filaLeida,
  leerFilas,
  mencionesNuevas,
  usuarioPorApodo,
  vencimientosDe,
  type Notificacion,
  type TipoNotificacion,
  type Usuario,
} from "./modelo";

/** Los usuarios del sistema: los mails habilitados, con su apodo (Mati, Tade…). */
export function usuariosDelSistema(): Usuario[] {
  return [...allowedEmails()].map((email) => {
    const p = persona(email);
    return { email, apodo: p.apodo, nombre: p.nombre };
  });
}

function pestania() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Las notificaciones no se pueden guardar: falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return new PestaniaSimple(client, sheet, "Notificaciones", COLUMNAS_NOTIFICACIONES);
}

// Los vencimientos se calculan leyendo varias pestañas: se guardan un minuto por usuario.
const cacheVencimientos = new Map<string, { cuando: number; valor: Notificacion[] }>();

async function vencimientos(usuario: Usuario): Promise<Notificacion[]> {
  const c = cacheVencimientos.get(usuario.email);
  if (c && Date.now() - c.cuando < 60_000) return c.valor;
  const activos = PROYECTOS.filter((p) => p.estado === "activo");
  const [tareas, crm, agenda, propuestas] = await Promise.all([
    leerTareas().then((x) => x.tareas).catch(() => []),
    leerCrm().then((x) => x.contactos).catch(() => []),
    leerAgenda().catch(() => []),
    Promise.all(activos.map((p) => leerPropuestas(p.id).catch(() => []))).then((x) => x.flat()),
  ]);
  const valor = vencimientosDe(usuario.apodo, { tareas, contactos: crm, agenda, propuestas }, hoyBuenosAires()).map((n) => ({ ...n, para: usuario.email }));
  cacheVencimientos.set(usuario.email, { cuando: Date.now(), valor });
  return valor;
}

/** Las notificaciones de un usuario (las últimas 60). */
export async function notificacionesDe(email: string): Promise<Notificacion[]> {
  const yo = usuariosDelSistema().find((u) => u.email === email.toLowerCase()) ?? { email, apodo: persona(email).apodo, nombre: email };
  const [filas, calculadas] = await Promise.all([pestania().filas(), vencimientos(yo)]);
  const { guardadas, leidas } = leerFilas(filas, email);
  return combinar(guardadas, calculadas, leidas).slice(0, 60);
}

export async function marcarLeidas(email: string, ids: string[]): Promise<void> {
  const ahora = new Date().toISOString();
  await pestania().agregarVarias([...new Set(ids)].slice(0, 200).map((id) => filaLeida(id, email, ahora)));
}

/** Guarda notificaciones (sin la de uno mismo). Si falla, se anota y sigue: avisar nunca rompe lo que se estaba guardando. */
export async function notificar(lista: { para: Usuario; tipo: TipoNotificacion; titulo: string; texto: string; link: string; de: string; deEmail?: string }[]): Promise<void> {
  const filas = lista
    .filter((n) => n.para.email !== n.deEmail?.toLowerCase() && n.para.apodo !== n.de)
    .map((n) => filaDeNotificacion({ id: nuevoId(), para: n.para.email, fecha: new Date().toISOString(), tipo: n.tipo, titulo: n.titulo, texto: n.texto, link: n.link, de: n.de }));
  if (!filas.length) return;
  try {
    await pestania().agregarVarias(filas);
  } catch (e) {
    console.error("notificar", e);
  }
}

/** Avisa a los mencionados con @ en un texto (solo las menciones nuevas si se editó). */
export async function avisarMenciones(o: { antes?: string; texto: string; titulo: string; link: string; de: string; deEmail: string }): Promise<void> {
  const usuarios = usuariosDelSistema();
  const nuevos = mencionesNuevas(o.antes ?? "", o.texto, usuarios);
  await notificar(nuevos.map((u) => ({ para: u, tipo: "mencion" as const, titulo: `${o.de} te mencionó · ${o.titulo}`, texto: extracto(o.texto), link: o.link, de: o.de, deEmail: o.deEmail })));
}

/** Avisa a quien le asignaron algo (si no se lo asignó solo). */
export async function avisarAsignacion(o: { apodo: string; titulo: string; texto: string; link: string; de: string; deEmail: string }): Promise<void> {
  const u = usuarioPorApodo(o.apodo, usuariosDelSistema());
  if (u) await notificar([{ para: u, tipo: "asignacion", titulo: `${o.de} te asignó: ${o.titulo}`, texto: o.texto, link: o.link, de: o.de, deEmail: o.deEmail }]);
}
