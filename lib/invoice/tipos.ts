import type { Factura, Invoice, Letra, TipoComprobante } from "./schema";

/** Códigos de tipo de comprobante de ARCA, por tipo y letra. */
const CODIGOS_ARCA: Partial<Record<TipoComprobante, Partial<Record<Letra, number>>>> = {
  factura: { A: 1, B: 6, C: 11, E: 19, M: 51 },
  nota_debito: { A: 2, B: 7, C: 12, E: 20, M: 52 },
  nota_credito: { A: 3, B: 8, C: 13, E: 21, M: 53 },
  recibo: { A: 4, B: 9, C: 15, M: 54 },
};

/** Como se escriben en la planilla. */
const NOMBRES: Record<TipoComprobante, string> = {
  factura: "Factura",
  nota_credito: "Nota de Crédito",
  nota_debito: "Nota de Débito",
  recibo: "Recibo",
  ticket: "Ticket",
  liquidacion: "Liquidación",
  otro: "Otro",
};

/** Código ARCA del comprobante: el impreso o, si no está, el que surge del tipo y la letra. */
export function codigoArca(inv: Pick<Invoice, "codigo_arca" | "tipo_comprobante" | "letra">): number | null {
  if (inv.codigo_arca != null) return inv.codigo_arca;
  if (inv.letra == null) return null;
  return CODIGOS_ARCA[inv.tipo_comprobante]?.[inv.letra] ?? null;
}

/** Texto para la planilla, por ejemplo "Factura A" o "Nota de Crédito B". */
export function formatTipo(inv: Pick<Invoice, "tipo_comprobante" | "letra">): string {
  const nombre = NOMBRES[inv.tipo_comprobante];
  return inv.letra ? `${nombre} ${inv.letra}` : nombre;
}

/** N° de comprobante con el formato habitual: 00001-00001234. */
export function formatNumero(inv: Pick<Invoice, "punto_venta" | "numero">): string | null {
  if (inv.punto_venta == null || inv.numero == null) return null;
  return `${String(inv.punto_venta).padStart(5, "0")}-${String(inv.numero).padStart(8, "0")}`;
}

/** Facturas, notas de crédito y notas de débito se numeran por separado. */
export type Familia = "FC" | "NC" | "ND";

export function familia(tipo: TipoComprobante): Familia {
  if (tipo === "nota_credito") return "NC";
  if (tipo === "nota_debito") return "ND";
  return "FC";
}

/** La familia de un tipo escrito en la planilla: "Nota de Crédito ", "Factura A", "Liquidación A"... */
export function familiaDeTexto(tipo: string): Familia {
  const t = tipo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (/^(nota de credito|nc)\b/.test(t)) return "NC";
  if (/^(nota de debito|nd)\b/.test(t)) return "ND";
  return "FC";
}

/** "00005-00025853" o "000001-0000295": punto de venta y número. */
export function parseNumero(texto: string): { punto_venta: number; numero: number } | null {
  const m = texto.match(/(\d+)\D+(\d+)/);
  return m ? { punto_venta: Number(m[1]), numero: Number(m[2]) } : null;
}

/** Clave de una fila de egresos: CUIT del proveedor, familia, punto de venta y número. */
export function claveEgreso(cuit: string, fam: Familia, punto_venta: number, numero: number): string {
  return `E|${cuit.replace(/\D/g, "")}|${fam}|${punto_venta}|${numero}`;
}

/** Clave de una fila de ingresos: el emisor siempre es Mindlin, así que alcanza con familia y número. */
export function claveIngreso(fam: Familia, punto_venta: number, numero: number): string {
  return `I|${fam}|${punto_venta}|${numero}`;
}

/**
 * Clave para detectar duplicados contra lo que ya está en la planilla. Se arma igual desde una
 * factura y desde una fila (ver lib/sheets/registros.ts), así que también encuentra las facturas
 * cargadas a mano. Devuelve null si falta algún dato.
 */
export function claveDuplicado(
  f: Pick<Factura, "categoria" | "cuit" | "tipo_comprobante" | "punto_venta" | "numero">,
): string | null {
  if (f.punto_venta == null || f.numero == null) return null;
  if (f.categoria === "venta") return claveIngreso(familia(f.tipo_comprobante), f.punto_venta, f.numero);
  if (!f.cuit) return null;
  return claveEgreso(f.cuit, familia(f.tipo_comprobante), f.punto_venta, f.numero);
}
