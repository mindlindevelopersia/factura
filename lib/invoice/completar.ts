import { EMPRESA, type Empresa } from "../empresa";
import { normalizeCuit } from "../validation/cuit";
import type { Categoria, Factura, Invoice } from "./schema";

/** Una fila ya cargada en la pestaña de egresos, con lo que sirve para proponer la próxima del mismo proveedor. */
export interface EgresoPrevio {
  fila: number;
  cuit: string;
  razon_social: string;
  rubro: string;
  concepto: string;
  corresponde_a: string;
}

/** Una fila ya cargada en la pestaña de ingresos, con lo que sirve para proponer la próxima del mismo cliente. */
export interface IngresoPrevio {
  fila: number;
  cuit_receptor: string;
  cliente: string;
  tipo_pago: string;
  depto: string;
}

export interface Historial {
  egresos: EgresoPrevio[];
  ingresos: IngresoPrevio[];
}

/** Venta si el emisor es Mindlin, honorarios si es un socio, compra en los demás casos. */
export function categoriaDe(inv: Pick<Invoice, "cuit">, empresa: Empresa = EMPRESA): Categoria {
  const cuit = normalizeCuit(inv.cuit ?? "");
  if (!cuit) return "compra";
  if (cuit === normalizeCuit(empresa.cuit)) return "venta";
  if (empresa.socios.some((s) => normalizeCuit(s.cuit) === cuit)) return "honorarios";
  return "compra";
}

/** El último valor no vacío de un campo, en el orden de la planilla. */
function ultimo<T, K extends keyof T>(filas: T[], campo: K): T[K] | null {
  for (let i = filas.length - 1; i >= 0; i--) {
    const v = filas[i][campo];
    if (typeof v === "string" ? v.trim() !== "" : v != null) return v;
  }
  return null;
}

export interface Completada {
  factura: Factura;
  /** Fila de la carga anterior de la que se tomaron datos, si la hubo. */
  desde: { pestania: "egresos" | "ingresos"; fila: number } | null;
}

/**
 * Agrega a lo que leyó la IA la categoría y lo que sale de la última carga de la misma
 * contraparte. El equipo carga casi siempre a los mismos proveedores, y la planilla es la
 * referencia de cómo se anota cada uno:
 * - Compras y honorarios, por CUIT del emisor: razón social, rubro y "corresponde a" como
 *   en la última fila. El concepto, solo si las dos últimas filas lo repiten (un abono, por
 *   ejemplo); si no, queda el que propuso la IA.
 * - Ventas, por CUIT del receptor: cliente, tipo de pago y depto. Sin carga anterior, el
 *   cliente es el receptor del comprobante.
 */
export function completarFactura(inv: Invoice, historial: Historial | null, empresa: Empresa = EMPRESA): Completada {
  const categoria = categoriaDe(inv, empresa);
  const factura: Factura = { ...inv, categoria, cliente: null, tipo_pago: null, depto: null };

  if (categoria === "venta") {
    const receptor = normalizeCuit(inv.cuit_receptor ?? "");
    const previas = receptor ? (historial?.ingresos ?? []).filter((f) => normalizeCuit(f.cuit_receptor) === receptor) : [];
    factura.cliente = ultimo(previas, "cliente") ?? inv.razon_social_receptor;
    factura.tipo_pago = ultimo(previas, "tipo_pago");
    factura.depto = ultimo(previas, "depto");
    const fila = previas.at(-1)?.fila;
    return { factura, desde: fila ? { pestania: "ingresos", fila } : null };
  }

  const emisor = normalizeCuit(inv.cuit ?? "");
  const previas = emisor ? (historial?.egresos ?? []).filter((f) => normalizeCuit(f.cuit) === emisor) : [];
  if (previas.length === 0) return { factura, desde: null };

  factura.razon_social = ultimo(previas, "razon_social") ?? inv.razon_social;
  factura.rubro = ultimo(previas, "rubro") ?? inv.rubro;
  factura.corresponde_a = ultimo(previas, "corresponde_a") ?? inv.corresponde_a;
  const [anteultima, ultima] = previas.slice(-2).map((f) => f.concepto.trim());
  if (previas.length >= 2 && ultima && ultima === anteultima) factura.concepto = ultima;
  return { factura, desde: { pestania: "egresos", fila: previas.at(-1)!.fila } };
}
