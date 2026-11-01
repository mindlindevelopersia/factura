/**
 * Las propuestas comerciales guardadas: una fila por propuesta en la pestaña "Propuestas" de la
 * planilla del CRM. Se guardan los parámetros (los mismos del link de la propuesta) y, para que se
 * lea bien en la planilla, la unidad, el cliente y los montos. Todo puro (sin red).
 */

import { nombreMes } from "../finanzas/ingresos";
import { telefonoWhatsapp } from "../inversores/cobranzas";
import type { ParametrosPropuesta, Propuesta } from "./propuesta";

export interface PropuestaGuardada {
  id: string;
  proyecto: string;
  /** ISO. */
  creada: string;
  actualizada: string;
  /** Quién la hizo (apodo: Mati, Tade). */
  autor: string;
  /** Quién la cambió por última vez. */
  editor: string;
  cliente: string;
  contactoId: string;
  unidad: string;
  precioUsd: number;
  totalArs: number;
  /** "2026-11-08". */
  vence: string;
  /** Los parámetros, como en el link (propuestaAUrl). */
  parametros: string;
}

export const COLUMNAS_PROPUESTAS = [
  "ID",
  "Proyecto",
  "Creada",
  "Actualizada",
  "Hizo",
  "Cambió",
  "Cliente",
  "ID contacto",
  "Unidad",
  "Valor USD",
  "Valor ARS",
  "Vence",
  "Parámetros",
] as const;

export function filaDePropuesta(p: PropuestaGuardada): string[] {
  return [p.id, p.proyecto, p.creada, p.actualizada, p.autor, p.editor, p.cliente, p.contactoId, p.unidad, String(p.precioUsd), String(Math.round(p.totalArs)), p.vence, p.parametros];
}

export function propuestaDeFila(f: string[]): PropuestaGuardada {
  const n = (t: string | undefined) => Number(t) || 0;
  return {
    id: f[0] ?? "",
    proyecto: f[1] ?? "",
    creada: f[2] ?? "",
    actualizada: f[3] ?? f[2] ?? "",
    autor: f[4] ?? "",
    editor: f[5] ?? "",
    cliente: f[6] ?? "",
    contactoId: f[7] ?? "",
    unidad: f[8] ?? "",
    precioUsd: n(f[9]),
    totalArs: n(f[10]),
    vence: f[11] ?? "",
    parametros: f[12] ?? "",
  };
}

/** Lo que manda la pantalla al guardar. */
export interface DatosPropuesta {
  cliente: string;
  contactoId: string;
  unidad: string;
  precioUsd: number;
  totalArs: number;
  vence: string;
  parametros: string;
}

/** Revisa lo que llega del navegador: el error, o los datos limpios. */
export function validarPropuesta(x: unknown): { error: string } | { datos: DatosPropuesta } {
  const o = (x ?? {}) as Record<string, unknown>;
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const datos: DatosPropuesta = {
    cliente: texto(o.cliente, 120),
    contactoId: texto(o.contactoId, 40),
    unidad: texto(o.unidad, 20),
    precioUsd: numero(o.precioUsd) ?? -1,
    totalArs: numero(o.totalArs) ?? -1,
    vence: texto(o.vence, 10),
    parametros: texto(o.parametros, 3000),
  };
  if (!datos.unidad) return { error: "Falta la unidad." };
  if (datos.precioUsd < 0 || datos.totalArs < 0) return { error: "El valor no es un número." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.vence)) return { error: "Falta la fecha de vencimiento." };
  if (!datos.parametros) return { error: "Faltan los datos de la propuesta." };
  return { datos };
}

/** El mensaje de WhatsApp para mandarle la propuesta al cliente (el PDF se adjunta a mano). */
export function mensajePropuesta(p: ParametrosPropuesta, r: Propuesta, proyecto: string): string {
  const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("es-AR")}`;
  const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
  const mes = (m: string) => nombreMes(m).toLowerCase();
  const primerNombre = p.cliente.trim().split(/\s+/)[0];
  const anticipo = p.anticipoAUsd + p.anticipoBUsd;
  const refuerzos = [...new Set([...r.A.refuerzos, ...r.B.refuerzos].map((x) => x.mes))].sort();
  const lineas = [
    `${primerNombre ? `¡Hola ${primerNombre}!` : "¡Hola!"} Te comparto la propuesta por la UF ${p.unidad} de ${proyecto}.`,
    "",
    `• Aporte estimado: ${usd(p.precioUsd)} (${ars(r.totalArs)} al dólar MEP de $ ${p.tipoCambio.toLocaleString("es-AR")}).`,
    anticipo ? `• Anticipo a la firma: ${usd(anticipo)}.` : "",
    p.cuotas.cantidad && r.A.cuotaArs ? `• ${p.cuotas.cantidad} cuotas mensuales de ${ars(r.A.cuotaArs)}, desde ${mes(p.cuotas.desde)}.` : "",
    refuerzos.length ? `• ${refuerzos.length === 1 ? "Un refuerzo" : `${refuerzos.length} refuerzos`} en ${refuerzos.map(mes).join(" y ")}.` : "",
    "",
    `Las cuotas y los refuerzos se ajustan por CAC. Te adjunto el PDF con el detalle. La propuesta vale hasta el ${r.hasta.split("-").reverse().join("/")}.`,
    "",
    "Cualquier duda, quedo a disposición.",
  ];
  return lineas.filter((x, i) => x || (lineas[i - 1] ?? "") !== "").join("\n").trim();
}

/** El link de WhatsApp: al teléfono del contacto si sirve; si no, WhatsApp pregunta a quién mandarlo. */
export function whatsappPropuesta(telefono: string, texto: string): string {
  const n = telefonoWhatsapp(telefono);
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(texto)}`;
}
