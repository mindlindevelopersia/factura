import type { Invoice, Letra, TipoComprobante } from "./schema";

/** Códigos de tipo de comprobante de ARCA, por tipo y letra. */
const CODIGOS_ARCA: Partial<Record<TipoComprobante, Partial<Record<Letra, number>>>> = {
  factura: { A: 1, B: 6, C: 11, E: 19, M: 51 },
  nota_debito: { A: 2, B: 7, C: 12, E: 20, M: 52 },
  nota_credito: { A: 3, B: 8, C: 13, E: 21, M: 53 },
  recibo: { A: 4, B: 9, C: 15, M: 54 },
};

const NOMBRES: Record<TipoComprobante, string> = {
  factura: "Factura",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
  recibo: "Recibo",
  ticket: "Ticket",
  otro: "Otro",
};

/** Código ARCA del comprobante: el impreso o, si no está, el que surge del tipo y la letra. */
export function codigoArca(inv: Pick<Invoice, "codigo_arca" | "tipo_comprobante" | "letra">): number | null {
  if (inv.codigo_arca != null) return inv.codigo_arca;
  if (inv.letra == null) return null;
  return CODIGOS_ARCA[inv.tipo_comprobante]?.[inv.letra] ?? null;
}

/** Texto para la planilla, por ejemplo "Factura A" o "Nota de crédito B". */
export function formatTipo(inv: Pick<Invoice, "tipo_comprobante" | "letra">): string {
  const nombre = NOMBRES[inv.tipo_comprobante];
  return inv.letra ? `${nombre} ${inv.letra}` : nombre;
}

/** N° de comprobante con el formato habitual: 00001-00001234. */
export function formatNumero(inv: Pick<Invoice, "punto_venta" | "numero">): string | null {
  if (inv.punto_venta == null || inv.numero == null) return null;
  return `${String(inv.punto_venta).padStart(5, "0")}-${String(inv.numero).padStart(8, "0")}`;
}

/**
 * Clave para detectar duplicados: CUIT emisor + tipo + punto de venta + número.
 * Devuelve null si falta alguno de los datos.
 */
export function claveDuplicado(
  inv: Pick<Invoice, "cuit" | "codigo_arca" | "tipo_comprobante" | "letra" | "punto_venta" | "numero">,
): string | null {
  const numero = formatNumero(inv);
  if (!inv.cuit || numero == null) return null;
  const tipo = codigoArca(inv) ?? `${inv.tipo_comprobante}-${inv.letra ?? ""}`;
  return `${inv.cuit.replace(/\D/g, "")}|${tipo}|${numero}`;
}
