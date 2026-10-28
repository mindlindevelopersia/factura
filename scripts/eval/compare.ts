import type { EgresoPrevio, Historial, IngresoPrevio } from "../../lib/invoice/completar";
import type { Factura } from "../../lib/invoice/schema";
import { claveEgreso, claveIngreso, familiaDeTexto, formatTipo } from "../../lib/invoice/tipos";
import { normalizeCuit } from "../../lib/validation/cuit";

/** Fila de la planilla cargada a mano, con los encabezados ya normalizados (ver README). */
export type FilaEsperada = Record<string, string>;

export type Decimal = "coma" | "punto";

export interface Comparacion {
  /** null si no se compara (el valor esperado está vacío). */
  acierto: boolean | null;
  esperado: string;
  obtenido: string;
}

type Comparador = (esperado: string, inv: Factura, decimal: Decimal) => Comparacion;

export function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function texto(s: string): string {
  return sinAcentos(s).toLowerCase().replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Convierte un importe de la planilla a número: "1.234,56" con decimal coma, "1,234.56" con decimal punto. */
export function parseImporte(s: string, decimal: Decimal): number | null {
  let limpio = s.replace(/[^\d.,-]/g, "");
  if (limpio === "" || limpio === "-") return null;
  limpio = decimal === "coma" ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/,/g, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Acepta AAAA-MM-DD, DD/MM/AAAA y DD/MM/AA. Devuelve AAAA-MM-DD o null. */
export function parseFecha(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/** "FC A", "Factura A", "NC B", "Nota de Crédito B" pasan a "factura a", "nota de credito b", etc. */
export function normalizeTipo(s: string): string {
  const t = texto(s);
  const letra = t.match(/\b([abcme])$/)?.[1] ?? "";
  let tipo = t;
  if (/^(nc|n c|nota de credito|nota credito)\b/.test(t)) tipo = "nota de credito";
  else if (/^(nd|n d|nota de debito|nota debito)\b/.test(t)) tipo = "nota de debito";
  else if (/^(fc|fa|fac|fact|factura)\b/.test(t)) tipo = "factura";
  else if (/^(rec|recibo)\b/.test(t)) tipo = "recibo";
  else if (/^(tk|tique|ticket)\b/.test(t)) tipo = "ticket";
  else if (/^(liq|liquidacion)\b/.test(t)) tipo = "liquidacion";
  return letra && tipo !== t ? `${tipo} ${letra}` : tipo;
}

export function normalizeMoneda(s: string): string {
  const t = texto(s);
  if (["$", "", "ars", "peso", "pesos", "pes"].includes(t) || s.trim() === "$") return "ARS";
  if (/^(usd|u s s|us|dol|dolar|dolares)/.test(t) || /u\$s|us\$/i.test(s)) return "USD";
  if (/^(eur|euro)/.test(t)) return "EUR";
  return s.trim().toUpperCase();
}

const SUFIJOS_SOCIETARIOS = /\b(s ?a ?s|s ?a|s ?r ?l|s ?a ?c ?i ?f ?i ?a|s ?h|s ?c ?a|srl|sa|sas)\b/g;

/** Razón social sin acentos, puntuación ni tipo societario. */
export function normalizeRazonSocial(s: string): string {
  return texto(s).replace(SUFIJOS_SOCIETARIOS, " ").replace(/\s+/g, " ").trim();
}

/** Proporción de palabras del texto esperado que aparecen en el obtenido. */
export function solapamiento(esperado: string, obtenido: string): number {
  const palabras = (s: string) => new Set(texto(s).split(" ").filter((w) => w.length > 2));
  const e = palabras(esperado);
  if (e.size === 0) return 1;
  const o = palabras(obtenido);
  let comunes = 0;
  for (const w of e) if (o.has(w)) comunes++;
  return comunes / e.size;
}

const vacio = (s: string) => s.trim() === "";

const igualNormalizado =
  (normalizar: (s: string) => string, obtener: (inv: Factura) => string | number | null): Comparador =>
  (esperado, inv) => {
    const obtenido = String(obtener(inv) ?? "");
    if (vacio(esperado)) return { acierto: null, esperado, obtenido };
    return { acierto: normalizar(esperado) === normalizar(obtenido), esperado, obtenido };
  };

const importe =
  (obtener: (inv: Factura) => number): Comparador =>
  (esperado, inv, decimal) => {
    const obtenido = obtener(inv);
    // En la planilla, una celda vacía en una columna de importes es 0.
    const e = vacio(esperado) ? 0 : parseImporte(esperado, decimal);
    return { acierto: e != null && Math.abs(e - obtenido) <= 0.01, esperado, obtenido: String(obtenido) };
  };

const mismaRazonSocial =
  (obtener: (inv: Factura) => string): Comparador =>
  (esperado, inv) => {
    const obtenido = obtener(inv);
    if (vacio(esperado)) return { acierto: null, esperado, obtenido };
    const e = normalizeRazonSocial(esperado);
    const o = normalizeRazonSocial(obtenido);
    return { acierto: e === o || (e.length > 0 && o.length > 0 && (e.includes(o) || o.includes(e))), esperado, obtenido };
  };

/** "0001-00001234" o "1234": devuelve [punto de venta, número]. */
export function parseNumeroComprobante(s: string): [number | null, number | null] {
  const partes = s.split(/[-\s/]+/).map((p) => p.replace(/\D/g, "")).filter(Boolean);
  if (partes.length >= 2) return [Number(partes[0]), Number(partes[partes.length - 1])];
  if (partes.length === 1) return [null, Number(partes[0])];
  return [null, null];
}

/**
 * Campos que se comparan y cómo. La clave es el encabezado de la columna en el CSV esperado.
 * forma de pago, banco, retención y demás no se comparan porque la IA no los completa.
 */
export const COMPARADORES: Record<string, Comparador> = {
  fecha_factura: igualNormalizado((s) => parseFecha(s) ?? s, (inv) => inv.fecha_factura),
  // La planilla escribe "Nota de Crédito " sin letra: si no la tiene, no se compara la letra.
  tipo_comprobante: (esperado, inv) => {
    const obtenido = formatTipo(inv);
    if (vacio(esperado)) return { acierto: null, esperado, obtenido };
    const e = normalizeTipo(esperado);
    const o = normalizeTipo(obtenido);
    const sinLetra = (t: string) => t.replace(/ [abcme]$/, "");
    return { acierto: e === o || (sinLetra(e) === e && sinLetra(o) === e), esperado, obtenido };
  },
  punto_venta: (esperado, inv) => {
    const obtenido = String(inv.punto_venta ?? "");
    if (vacio(esperado)) return { acierto: null, esperado, obtenido };
    return { acierto: Number(esperado.replace(/\D/g, "")) === inv.punto_venta, esperado, obtenido };
  },
  numero: (esperado, inv) => {
    const obtenido = String(inv.numero ?? "");
    if (vacio(esperado)) return { acierto: null, esperado, obtenido };
    const [pv, numero] = parseNumeroComprobante(esperado);
    const acierto = numero === inv.numero && (pv == null || pv === inv.punto_venta);
    return { acierto, esperado, obtenido: pv == null ? obtenido : `${inv.punto_venta}-${inv.numero}` };
  },
  razon_social: mismaRazonSocial((inv) => inv.razon_social),
  cuit: igualNormalizado(normalizeCuit, (inv) => inv.cuit),
  cuit_receptor: igualNormalizado(normalizeCuit, (inv) => inv.cuit_receptor),
  rubro: igualNormalizado(texto, (inv) => inv.rubro),
  corresponde_a: igualNormalizado(texto, (inv) => inv.corresponde_a),
  cliente: mismaRazonSocial((inv) => inv.cliente ?? ""),
  tipo_pago: igualNormalizado(texto, (inv) => inv.tipo_pago),
  depto: igualNormalizado(texto, (inv) => inv.depto),
  concepto: (esperado, inv) => {
    const obtenido = inv.concepto;
    if (vacio(esperado)) return { acierto: null, esperado, obtenido };
    return { acierto: solapamiento(esperado, obtenido) >= 0.5, esperado, obtenido };
  },
  moneda: igualNormalizado(normalizeMoneda, (inv) => inv.moneda),
  neto_gravado: importe((inv) => inv.neto_gravado),
  no_gravado: importe((inv) => inv.no_gravado),
  iva_21: importe((inv) => inv.iva_21),
  iva_10_5: importe((inv) => inv.iva_10_5),
  percepcion_iva: importe((inv) => inv.percepcion_iva),
  percepcion_iibb_caba: importe((inv) => inv.percepcion_iibb_caba),
  percepcion_iibb_pba: importe((inv) => inv.percepcion_iibb_pba),
  total: importe((inv) => inv.total),
  // Ventas: la columna "Importe" es el neto.
  importe_ventas: importe((inv) => inv.neto_gravado + inv.no_gravado),
};

/** Compara una factura contra su fila esperada. Solo usa las columnas presentes en el CSV. */
export function compararFila(fila: FilaEsperada, inv: Factura, decimal: Decimal): Record<string, Comparacion> {
  const resultado: Record<string, Comparacion> = {};
  for (const [campo, comparar] of Object.entries(COMPARADORES)) {
    if (campo in fila) resultado[campo] = comparar(fila[campo], inv, decimal);
  }
  return resultado;
}

/** Una fila es de la pestaña de ingresos (ventas) si tiene la columna del cliente. */
export function esIngreso(fila: FilaEsperada): boolean {
  return "cliente" in fila;
}

/**
 * Clave para emparejar una fila con una factura cuando el CSV no tiene la columna archivo.
 * Es la misma que usa la app para los duplicados (claveDuplicado), así que se compara contra
 * la clave de la factura ya completada.
 */
export function claveDeFila(fila: FilaEsperada): string | null {
  let [pv, numero] = parseNumeroComprobante(fila.numero ?? "");
  if (fila.punto_venta?.trim()) pv = Number(fila.punto_venta.replace(/\D/g, ""));
  if (pv == null || numero == null) return null;
  const fam = familiaDeTexto(fila.tipo_comprobante ?? "");
  if (esIngreso(fila)) return claveIngreso(fam, pv, numero);
  const cuit = normalizeCuit(fila.cuit ?? "");
  return cuit ? claveEgreso(cuit, fam, pv, numero) : null;
}

/** Historial para completar las facturas, armado con las filas anteriores al mes que se evalúa. */
export function historialDeFilas(filas: FilaEsperada[]): Historial {
  const egresos: EgresoPrevio[] = [];
  const ingresos: IngresoPrevio[] = [];
  filas.forEach((f, i) => {
    if (esIngreso(f)) {
      const cuit_receptor = normalizeCuit(f.cuit_receptor ?? "");
      if (cuit_receptor) {
        ingresos.push({ fila: i + 2, cuit_receptor, cliente: f.cliente ?? "", tipo_pago: f.tipo_pago ?? "", depto: f.depto ?? "" });
      }
      return;
    }
    const cuit = normalizeCuit(f.cuit ?? "");
    if (!cuit) return;
    egresos.push({
      fila: i + 2,
      cuit,
      razon_social: f.razon_social ?? "",
      rubro: f.rubro ?? "",
      concepto: f.concepto ?? "",
      corresponde_a: f.corresponde_a ?? "",
    });
  });
  return { egresos, ingresos };
}

/** Categoría esperada según la carpeta, como las ordena el equipo: "Facturas Compras Octubre", etc. */
export function categoriaDeCarpeta(carpeta: string): Factura["categoria"] | null {
  const t = texto(carpeta);
  if (/honorario/.test(t)) return "honorarios";
  if (/venta/.test(t)) return "venta";
  if (/compra/.test(t)) return "compra";
  return null;
}

/** Encabezados habituales de la planilla y la columna del esquema a la que corresponden. */
const ALIAS: Record<string, string> = {
  archivo: "archivo",
  fecha: "fecha_factura",
  fecha_factura: "fecha_factura",
  tipo: "tipo_comprobante",
  tipo_de_comprobante: "tipo_comprobante",
  tipo_comprobante: "tipo_comprobante",
  comprobante: "tipo_comprobante",
  n: "numero",
  nro: "numero",
  numero: "numero",
  n_comprobante: "numero",
  punto_de_venta: "punto_venta",
  punto_venta: "punto_venta",
  pv: "punto_venta",
  razon_social: "razon_social",
  proveedor: "razon_social",
  rubro: "rubro",
  cuit: "cuit",
  concepto: "concepto",
  moneda: "moneda",
  proyecto: "corresponde_a",
  corresponde_a: "corresponde_a",
  // Encabezados de la planilla Administración Contable
  fecha_de_la_factura: "fecha_factura",
  n_comprobante_operacion: "numero",
  rubro_descripcion: "rubro",
  importe_neto_gravado: "neto_gravado",
  importe_no_gravado: "no_gravado",
  percepcion_iibb_prov_bsas: "percepcion_iibb_pba",
  importe_total: "total",
  cliente_inversor_razon_social: "cliente",
  cliente: "cliente",
  tipo_de_pago: "tipo_pago",
  cuit_receptor: "cuit_receptor",
  depto_adquirido: "depto",
  importe: "importe_ventas",
  comentario: "concepto",
  neto_gravado: "neto_gravado",
  neto: "neto_gravado",
  no_gravado: "no_gravado",
  iva_21: "iva_21",
  iva_10_5: "iva_10_5",
  percepcion_iva: "percepcion_iva",
  percepciones_iva: "percepcion_iva",
  iibb_caba: "percepcion_iibb_caba",
  percepcion_iibb_caba: "percepcion_iibb_caba",
  percepciones_iibb_caba: "percepcion_iibb_caba",
  iibb_pba: "percepcion_iibb_pba",
  percepcion_iibb_pba: "percepcion_iibb_pba",
  percepciones_iibb_pba: "percepcion_iibb_pba",
  total: "total",
};

export function normalizarEncabezado(h: string): string {
  const clave = sinAcentos(h)
    .toLowerCase()
    .replace(/°|º/g, "")
    .replace(/%/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return ALIAS[clave] ?? clave;
}
