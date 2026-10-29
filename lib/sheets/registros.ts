import type { EgresoPrevio, Historial, IngresoPrevio } from "../invoice/completar";
import type { Factura } from "../invoice/schema";
import { claveDuplicado, claveEgreso, claveIngreso, familiaDeTexto, parseNumero } from "../invoice/tipos";
import { normalizeCuit } from "../validation/cuit";

/** Una factura ya cargada con un número dado: en qué fila y por cuánto. */
export interface Cargada {
  fila: number;
  /** En valor absoluto (las notas de crédito están en negativo). NaN si la celda no tiene un número. */
  total: number;
}

/** Lo que ya está cargado en la planilla: para detectar duplicados y proponer datos. */
export interface Registros {
  historial: Historial;
  /** Por clave de duplicado (ver claveDuplicado), las filas cargadas con ese número. */
  cargadas: Map<string, Cargada[]>;
  /** Todas las filas con importe, para el panel. */
  movimientos: Movimiento[];
}

/** Una fila de la planilla, cargada a mano o por la app, resumida para el panel. */
export interface Movimiento {
  pestania: "egresos" | "ingresos";
  fila: number;
  /** Fecha de la factura, AAAA-MM-DD. null si la celda no tiene una fecha. */
  fecha: string | null;
  /** Razón social (egresos) o cliente (ingresos). */
  contraparte: string;
  /** CUIT del proveedor (egresos) o del receptor (ingresos), solo dígitos. */
  cuit: string;
  /** "Pesos", "Dólares"... como en la planilla. */
  moneda: string;
  /** Con signo: las notas de crédito están en negativo. NaN si la celda no tiene un número. */
  total: number;
}

/** Primera fila de datos (la 1 tiene los encabezados). */
export const PRIMERA_FILA = 2;

/**
 * Columnas que se leen de cada pestaña, con valorRenderOption=UNFORMATTED_VALUE: los importes
 * llegan como números, sin el formato de la planilla.
 */
export const RANGO_EGRESOS = "C2:T"; // Tipo, Nº, Razón Social, Rubro, CUIT, Concepto, Corresponde a ... Importe Total
export const RANGO_INGRESOS = "C2:M"; // Tipo, Nº, Cliente, Tipo de Pago, CUIT Receptor, Depto ... Importe Total
/** Fecha de la factura y de registro, en las dos pestañas. Se piden en el mismo batchGet. */
export const RANGO_FECHAS = "A2:B";
const TOTAL_EGRESOS = 17; // T, contando desde C
const TOTAL_INGRESOS = 10; // M, contando desde C
const MONEDA_EGRESOS = 9; // L, contando desde C
const MONEDA_INGRESOS = 6; // I, contando desde C

/** Diferencia de total que se acepta para decir que es la misma factura: la planilla calcula el IVA con fórmulas. */
export const TOLERANCIA_DUPLICADO = 1;

type Valor = string | number | boolean | null | undefined;
const texto = (fila: Valor[], i: number) => String(fila[i] ?? "").trim();
function total(fila: Valor[], i: number): number {
  return Math.abs(conSigno(fila, i));
}
function conSigno(fila: Valor[], i: number): number {
  const v = fila[i];
  if (typeof v === "number") return v;
  const limpio = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!limpio) return Number.NaN;
  // "1.234,56" (como lo escribe una persona) o "1234.56".
  const n = Number(limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Fechas de Sheets: número de serie (días desde el 30/12/1899) o texto dd/mm/aaaa o aaaa-mm-dd. */
export function fechaDeCelda(v: Valor): string | null {
  if (typeof v === "number" && v > 0) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const t = String(v ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/**
 * Arma el historial y el índice de facturas cargadas a partir de los valores de las dos
 * pestañas (los rangos de arriba, como los devuelve la API de Sheets). Las filas sin número
 * de comprobante, o de egresos sin CUIT, no cuentan para los duplicados.
 */
export function leerRegistros(
  egresos: Valor[][],
  ingresos: Valor[][],
  fechas: { egresos: Valor[][]; ingresos: Valor[][] } = { egresos: [], ingresos: [] },
): Registros {
  const cargadas = new Map<string, Cargada[]>();
  const movimientos: Movimiento[] = [];
  const anotar = (clave: string, c: Cargada) => cargadas.set(clave, [...(cargadas.get(clave) ?? []), c]);
  const historialEgresos: EgresoPrevio[] = [];
  const historialIngresos: IngresoPrevio[] = [];

  egresos.forEach((f, i) => {
    const [tipo, numero, razon_social, rubro, cuit, concepto, corresponde_a] = [0, 1, 2, 3, 4, 5, 6].map((c) => texto(f, c));
    const fila = PRIMERA_FILA + i;
    const n = parseNumero(numero);
    const digitos = normalizeCuit(cuit);
    if (n && digitos.length === 11) {
      anotar(claveEgreso(digitos, familiaDeTexto(tipo), n.punto_venta, n.numero), { fila, total: total(f, TOTAL_EGRESOS) });
    }
    if (digitos) historialEgresos.push({ fila, cuit: digitos, razon_social, rubro, concepto, corresponde_a });
    const monto = conSigno(f, TOTAL_EGRESOS);
    if (Number.isFinite(monto)) {
      movimientos.push({ pestania: "egresos", fila, fecha: fechaDeCelda(fechas.egresos[i]?.[0]), contraparte: razon_social, cuit: digitos, moneda: texto(f, MONEDA_EGRESOS), total: monto });
    }
  });

  ingresos.forEach((f, i) => {
    const [tipo, numero, cliente, tipo_pago, cuit_receptor, depto] = [0, 1, 2, 3, 4, 5].map((c) => texto(f, c));
    const fila = PRIMERA_FILA + i;
    const n = parseNumero(numero);
    if (n) anotar(claveIngreso(familiaDeTexto(tipo), n.punto_venta, n.numero), { fila, total: total(f, TOTAL_INGRESOS) });
    const digitos = normalizeCuit(cuit_receptor);
    if (digitos) historialIngresos.push({ fila, cuit_receptor: digitos, cliente, tipo_pago, depto });
    const monto = conSigno(f, TOTAL_INGRESOS);
    if (Number.isFinite(monto)) {
      movimientos.push({ pestania: "ingresos", fila, fecha: fechaDeCelda(fechas.ingresos[i]?.[0]), contraparte: cliente, cuit: digitos, moneda: texto(f, MONEDA_INGRESOS), total: monto });
    }
  });

  return { historial: { egresos: historialEgresos, ingresos: historialIngresos }, cargadas, movimientos };
}

/**
 * Si la factura ya está en la planilla:
 * - duplicada: mismo proveedor, tipo, punto de venta y número, y el mismo total (±$1). No se deja cargar de nuevo.
 * - mismo_numero: el número ya está cargado pero con otro total. Pasa, por ejemplo, con las
 *   liquidaciones de Banco Nación, que repiten el número de un mes a otro. Se avisa y se deja cargar.
 */
export interface Coincidencia {
  tipo: "duplicada" | "mismo_numero";
  fila: number;
}

export function buscarCargada(
  registros: Registros | null,
  f: Pick<Factura, "categoria" | "cuit" | "tipo_comprobante" | "punto_venta" | "numero" | "total">,
): Coincidencia | null {
  const clave = claveDuplicado(f);
  const filas = clave ? registros?.cargadas.get(clave) : undefined;
  if (!filas?.length) return null;
  // Sin total legible en la planilla, por las dudas se toma como la misma factura.
  const misma = filas.find((c) => Number.isNaN(c.total) || Math.abs(c.total - Math.abs(f.total)) <= TOLERANCIA_DUPLICADO);
  return misma ? { tipo: "duplicada", fila: misma.fila } : { tipo: "mismo_numero", fila: filas[0].fila };
}
