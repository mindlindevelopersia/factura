/**
 * El calendario del proyecto: todo lo que tiene fecha, en un solo lugar.
 *
 * - Cobros: lo que falta cobrar de cada inversor (Flujo de fondos), el día que vence (el 10, o el
 *   día especial de la cuenta).
 * - Pagos: lo que se pagó, del día de cada egreso de las cajas.
 * - Leads: el próximo paso de cada contacto del CRM y cuándo volver a contactar.
 * - Propuestas: cuándo vence cada propuesta comercial guardada.
 * - Tareas: las abiertas con fecha (del proyecto y las generales).
 * - Agenda: lo que se carga a mano (un pago a un proveedor, una reunión, una firma).
 *
 * Todo puro (sin red).
 */

import type { Contacto } from "../crm/modelo";
import { esDelProyecto } from "../crm/modelo";
import type { Egreso } from "../finanzas/egresos";
import type { Moneda, Pago } from "../finanzas/ingresos";
import { diaVencimiento } from "../inversores/cobranzas";
import type { PropuestaGuardada } from "../proyectos/propuestasGuardadas";
import { abierta, type Tarea } from "../tareas/modelo";

export type TipoEvento = "cobro" | "pago" | "lead" | "propuesta" | "tarea" | "agenda";

export const TIPOS_EVENTO: { tipo: TipoEvento; nombre: string }[] = [
  { tipo: "cobro", nombre: "Cobros" },
  { tipo: "pago", nombre: "Pagos" },
  { tipo: "lead", nombre: "Leads" },
  { tipo: "propuesta", nombre: "Propuestas" },
  { tipo: "tarea", nombre: "Tareas" },
  { tipo: "agenda", nombre: "Agenda" },
];

export interface Evento {
  id: string;
  /** "2026-11-10". */
  fecha: string;
  tipo: TipoEvento;
  titulo: string;
  detalle: string;
  monto: { moneda: Moneda; valor: number } | null;
  /** Ya pasó y no se hizo (un cobro sin cobrar, un seguimiento atrasado). */
  vencido: boolean;
  /** Adónde ir en el hub (relativo al proyecto: "inversores/cobranzas"). */
  donde: string | null;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/** Lo que falta cobrar de cada cuenta, el día que vence. Lo vencido y sin cobrar queda marcado. */
export function eventosCobros(cuentas: { inversor: string; unidad: string; pendientes: Pago[] }[], hoy: string): Evento[] {
  return cuentas.flatMap((c) => {
    const dia = diaVencimiento(c.inversor);
    return c.pendientes
      .filter((p) => p.mes && p.monto > 0)
      .map((p, i) => {
        const fecha = `${p.mes}-${dosDigitos(dia)}`;
        return {
          id: `cobro-${c.inversor}-${c.unidad}-${p.mes}-${i}`,
          fecha,
          tipo: "cobro" as const,
          titulo: `${c.inversor}${c.unidad ? ` · ${c.unidad}` : ""}`,
          detalle: p.detalle || (p.tipo === "refuerzo" ? "Refuerzo" : "Cuota"),
          monto: { moneda: p.moneda, valor: p.monto },
          vencido: fecha < hoy,
          donde: "inversores/cobranzas",
        };
      });
  });
}

/** Lo que se pagó desde las cajas, del proyecto (por la columna "Corresponde"). */
export function eventosPagos(egresos: Egreso[], nombreProyecto: string): Evento[] {
  const clave = nombreProyecto.toLowerCase().split(/\s+/)[0];
  return egresos
    .filter((e) => e.fecha && e.monto > 0 && e.proyecto.toLowerCase().includes(clave))
    .map((e) => ({
      id: `pago-${e.pestania}-${e.fila}`,
      fecha: e.fecha!,
      tipo: "pago" as const,
      titulo: e.descripcion || e.categoria || "Pago",
      detalle: [e.categoria, e.forma].filter(Boolean).join(" · "),
      monto: { moneda: e.moneda, valor: e.monto },
      vencido: false,
      donde: "finanzas/egresos",
    }));
}

/** El próximo paso de cada lead del proyecto y cuándo volver a contactar a los que se enfriaron. */
export function eventosLeads(contactos: Contacto[], proyecto: string, hoy: string): Evento[] {
  const r: Evento[] = [];
  for (const c of contactos) {
    if (!esDelProyecto(c, proyecto)) continue;
    const abierto = c.etapa !== "Vendido" && c.etapa !== "Perdido" && c.etapa !== "Dormido";
    if (c.proximaFecha && abierto) {
      r.push({
        id: `lead-${c.id}`,
        fecha: c.proximaFecha.slice(0, 10),
        tipo: "lead",
        titulo: `Hablar con ${c.nombre}`,
        detalle: [c.proximoPaso, c.etapa, c.responsable].filter(Boolean).join(" · "),
        monto: null,
        vencido: c.proximaFecha.slice(0, 10) < hoy,
        donde: `comercial/crm?contacto=${c.id}`,
      });
    }
    if (c.volverAContactar && !abierto) {
      r.push({
        id: `volver-${c.id}`,
        fecha: c.volverAContactar.slice(0, 10),
        tipo: "lead",
        titulo: `Volver a contactar a ${c.nombre}`,
        detalle: [c.etapa, c.motivoPerdida, c.responsable].filter(Boolean).join(" · "),
        monto: null,
        vencido: false,
        donde: `comercial/crm?contacto=${c.id}`,
      });
    }
  }
  return r;
}

/** El día que vence cada propuesta guardada. */
export function eventosPropuestas(propuestas: PropuestaGuardada[]): Evento[] {
  return propuestas
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.vence))
    .map((p) => ({
      id: `propuesta-${p.id}`,
      fecha: p.vence,
      tipo: "propuesta" as const,
      titulo: `Vence la propuesta UF ${p.unidad}${p.cliente ? ` · ${p.cliente}` : ""}`,
      detalle: `La hizo ${p.autor || "—"}`,
      monto: { moneda: "USD" as const, valor: p.precioUsd },
      vencido: false,
      donde: `comercial/propuesta?id=${p.id}&${p.parametros}${p.contactoId ? `&contacto=${p.contactoId}` : ""}`,
    }));
}

/** Las tareas abiertas con fecha, del proyecto y las generales. Las atrasadas quedan marcadas. */
export function eventosTareas(tareas: Tarea[], proyecto: string, hoy: string): Evento[] {
  return tareas
    .filter((t) => abierta(t) && t.vence && (!t.proyecto || t.proyecto === proyecto))
    .map((t) => ({
      id: `tarea-${t.id}`,
      fecha: t.vence!,
      tipo: "tarea" as const,
      titulo: t.titulo,
      detalle: [t.hora, t.responsable, t.con, t.estado].filter(Boolean).join(" · "),
      monto: null,
      vencido: t.vence! < hoy,
      donde: `tareas?tarea=${t.id}`,
    }));
}

/** Un evento cargado a mano (pestaña "Calendario" de la planilla del CRM). */
export interface EventoAgenda {
  id: string;
  proyecto: string;
  fecha: string;
  /** "Pago", "Cobro", "Reunión", "Firma", "Otro". */
  categoria: string;
  titulo: string;
  detalle: string;
  autor: string;
  creado: string;
}

export const CATEGORIAS_AGENDA = ["Pago", "Cobro", "Reunión", "Firma", "Obra", "Otro"] as const;

export const COLUMNAS_AGENDA = ["ID", "Proyecto", "Fecha", "Categoría", "Título", "Detalle", "Cargó", "Creado"] as const;

export const filaDeAgenda = (e: EventoAgenda): string[] => [e.id, e.proyecto, e.fecha, e.categoria, e.titulo, e.detalle, e.autor, e.creado];

export const agendaDeFila = (f: string[]): EventoAgenda => ({
  id: f[0] ?? "",
  proyecto: f[1] ?? "",
  fecha: f[2] ?? "",
  categoria: f[3] ?? "",
  titulo: f[4] ?? "",
  detalle: f[5] ?? "",
  autor: f[6] ?? "",
  creado: f[7] ?? "",
});

export function validarAgenda(x: unknown): { error: string } | { datos: Pick<EventoAgenda, "fecha" | "categoria" | "titulo" | "detalle"> } {
  const o = (x ?? {}) as Record<string, unknown>;
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const fecha = texto(o.fecha, 10);
  const titulo = texto(o.titulo, 160);
  const categoria = (CATEGORIAS_AGENDA as readonly string[]).includes(texto(o.categoria, 20)) ? texto(o.categoria, 20) : "Otro";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Falta la fecha." };
  if (!titulo) return { error: "Falta qué es." };
  return { datos: { fecha, categoria, titulo, detalle: texto(o.detalle, 500) } };
}

export function eventosAgenda(agenda: EventoAgenda[]): Evento[] {
  return agenda.map((e) => ({
    id: `agenda-${e.id}`,
    fecha: e.fecha,
    tipo: "agenda" as const,
    titulo: e.titulo,
    detalle: [e.categoria, e.detalle, e.autor ? `cargó ${e.autor}` : ""].filter(Boolean).join(" · "),
    monto: null,
    vencido: false,
    donde: null,
  }));
}

/** Las semanas de un mes para la grilla (de lunes a domingo), con los días de afuera en null. */
export function semanasDelMes(mes: string): (string | null)[][] {
  const [a, m] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const primero = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const celdas: (string | null)[] = [...Array(primero).fill(null), ...Array.from({ length: dias }, (_, i) => `${mes}-${dosDigitos(i + 1)}`)];
  while (celdas.length % 7) celdas.push(null);
  return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
}
