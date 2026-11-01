import "server-only";
import { CrmSinConfigurar, leerCrm } from "../crm/fuente";
import { nuevoId } from "../crm/modelo";
import { cajaEgresos, cuentasCorrientes } from "../finanzas/fuente";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { hoyBuenosAires } from "../inversores/cobranzas";
import { PROYECTO_PRINCIPAL, proyecto as buscarProyecto } from "../modulos";
import { leerPropuestas } from "../proyectos/propuestasFuente";
import { leerTareas } from "../tareas/fuente";
import {
  agendaDeFila,
  COLUMNAS_AGENDA,
  eventosAgenda,
  eventosCobros,
  eventosLeads,
  eventosPagos,
  eventosPropuestas,
  eventosTareas,
  filaDeAgenda,
  type Evento,
  type EventoAgenda,
  type TipoEvento,
} from "./eventos";

/** Lo cargado a mano vive en la planilla del CRM, en la pestaña "Calendario" (se crea sola). */
function pestania() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("El calendario no puede guardar: falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return new PestaniaSimple(client, sheet, "Calendario", COLUMNAS_AGENDA);
}

async function leerAgenda(proyecto: string): Promise<EventoAgenda[]> {
  const filas = await pestania().filas();
  return filas.filter((f) => f[0]).map(agendaDeFila).filter((e) => e.proyecto === proyecto);
}

export async function agregarAgenda(proyecto: string, datos: Pick<EventoAgenda, "fecha" | "categoria" | "titulo" | "detalle" | "responsable" | "hora">, autor: string): Promise<EventoAgenda> {
  const e: EventoAgenda = { id: nuevoId(), proyecto, autor, creado: new Date().toISOString(), ...datos, responsable: datos.responsable || autor };
  await pestania().agregar(filaDeAgenda(e));
  return e;
}

/** Borra un evento de la agenda (deja la fila vacía). false si no está. */
export async function borrarAgenda(proyecto: string, id: string): Promise<boolean> {
  const t = pestania();
  const filas = await t.filas();
  const i = filas.findIndex((f) => f[0] === id && f[1] === proyecto);
  if (i < 0) return false;
  await t.escribir(i + 2, COLUMNAS_AGENDA.map(() => ""));
  return true;
}

/**
 * Todos los eventos del proyecto. Cada fuente se lee por separado: si una falla (por ejemplo, la
 * planilla de caja), el resto sale igual y se avisa qué faltó.
 */
export async function calendario(proyectoId: string, opciones?: { fresco?: boolean }): Promise<{ eventos: Evento[]; faltan: { tipo: TipoEvento; error: string }[]; hoy: string }> {
  const p = buscarProyecto(proyectoId)!;
  const hoy = hoyBuenosAires();
  // Las cuentas y las cajas son las del proyecto principal (el único con planillas de finanzas por ahora).
  const principal = proyectoId === PROYECTO_PRINCIPAL.id;
  const fuentes: [TipoEvento, () => Promise<Evento[]>][] = [
    ["cobro", async () => (principal ? eventosCobros((await cuentasCorrientes(opciones)).cuentas.cuentas, hoy) : [])],
    ["pago", async () => (principal ? eventosPagos((await cajaEgresos(opciones)).caja.egresos, p.nombre) : [])],
    ["lead", async () => eventosLeads((await leerCrm()).contactos, proyectoId, hoy)],
    ["propuesta", async () => eventosPropuestas(await leerPropuestas(proyectoId))],
    ["tarea", async () => eventosTareas((await leerTareas()).tareas, proyectoId, hoy)],
    ["agenda", async () => eventosAgenda(await leerAgenda(proyectoId))],
  ];
  const leidos = await Promise.allSettled(fuentes.map(([, leer]) => leer()));
  const eventos: Evento[] = [];
  const faltan: { tipo: TipoEvento; error: string }[] = [];
  leidos.forEach((r, i) => {
    if (r.status === "fulfilled") eventos.push(...r.value);
    else {
      console.error("calendario", fuentes[i][0], r.reason);
      faltan.push({ tipo: fuentes[i][0], error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    }
  });
  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo) || a.titulo.localeCompare(b.titulo));
  return { eventos, faltan, hoy };
}
