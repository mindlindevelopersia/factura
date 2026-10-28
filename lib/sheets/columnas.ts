import type { CampoImporte, Invoice } from "../invoice/schema";
import { claveDuplicado, formatNumero, formatTipo } from "../invoice/tipos";
import { normalizeCuit } from "../validation/cuit";

export const ESTADO_INICIAL = "En revisión";

export interface DatosFila {
  invoice: Invoice;
  /** AAAA-MM-DD */
  fechaRegistro: string;
  link: string | null;
  cargadoPor: string;
}

type Celda = string | number;

/**
 * Texto que viene de la factura. Si empieza con =, +, - o @, Sheets lo tomaría como
 * fórmula: el apóstrofo lo fuerza a texto (y evita que una factura meta fórmulas).
 */
function texto(s: string | null | undefined): string {
  if (!s) return "";
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

/** Fuerza a texto un número largo (CAE, clave) para que Sheets no lo pase a notación científica. */
function comoTexto(s: string | null | undefined): string {
  return s ? `'${s}` : "";
}

function cuitConGuiones(cuit: string | null): string {
  if (!cuit) return "";
  const d = normalizeCuit(cuit);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : texto(cuit);
}

/** Las notas de crédito restan: sus importes van en negativo. */
function importe(campo: CampoImporte | "total") {
  return ({ invoice }: DatosFila): Celda => {
    const valor = invoice[campo];
    if (valor === 0) return "";
    return invoice.tipo_comprobante === "nota_credito" ? -valor : valor;
  };
}

const MONEDAS: Record<Invoice["moneda"], string> = { ARS: "$", USD: "USD", EUR: "EUR", otra: "Otra" };

/**
 * Columnas de la planilla, en orden. Las primeras siguen la ficha P02; las que vienen
 * después de "Link a la factura" las agrega la app. Las vacías las completa una persona
 * después (forma de pago, banco, retención, etc.).
 *
 * Si cambia el orden o el título de una columna en una planilla que ya tiene datos,
 * hay que cambiarlo también en la planilla.
 */
export const COLUMNAS: { titulo: string; valor: (d: DatosFila) => Celda }[] = [
  { titulo: "Fecha factura", valor: (d) => d.invoice.fecha_factura },
  { titulo: "Fecha registro", valor: (d) => d.fechaRegistro },
  { titulo: "Tipo de comprobante", valor: (d) => formatTipo(d.invoice) },
  { titulo: "N°", valor: (d) => formatNumero(d.invoice) ?? texto(String(d.invoice.numero ?? "")) },
  { titulo: "Razón social", valor: (d) => texto(d.invoice.razon_social) },
  { titulo: "Rubro", valor: (d) => texto(d.invoice.rubro) },
  { titulo: "CUIT", valor: (d) => cuitConGuiones(d.invoice.cuit) },
  { titulo: "Concepto", valor: (d) => texto(d.invoice.concepto) },
  { titulo: "Forma de pago", valor: () => "" },
  { titulo: "Banco", valor: () => "" },
  { titulo: "Moneda", valor: (d) => MONEDAS[d.invoice.moneda] },
  { titulo: "Neto gravado", valor: importe("neto_gravado") },
  { titulo: "No gravado", valor: importe("no_gravado") },
  { titulo: "IVA 21%", valor: importe("iva_21") },
  { titulo: "IVA 10,5%", valor: importe("iva_10_5") },
  { titulo: "Percepciones IVA", valor: importe("percepcion_iva") },
  { titulo: "IIBB CABA", valor: importe("percepcion_iibb_caba") },
  { titulo: "IIBB PBA", valor: importe("percepcion_iibb_pba") },
  { titulo: "Total", valor: importe("total") },
  { titulo: "Retención de ganancias", valor: () => "" },
  { titulo: "Monto a transferir", valor: () => "" },
  { titulo: "Comprobante de retención", valor: () => "" },
  { titulo: "Link a la factura", valor: (d) => d.link ?? "" },
  { titulo: "Proyecto", valor: (d) => d.invoice.proyecto ?? "" },
  { titulo: "Estado", valor: () => ESTADO_INICIAL },
  { titulo: "IVA otras alícuotas", valor: importe("iva_otras") },
  { titulo: "Otros tributos", valor: importe("otros_tributos") },
  { titulo: "Tipo de cambio", valor: (d) => d.invoice.tipo_cambio ?? "" },
  { titulo: "CAE", valor: (d) => comoTexto(d.invoice.cae) },
  { titulo: "Cargado por", valor: (d) => d.cargadoPor },
  // Última columna: la app la lee para detectar duplicados.
  { titulo: "Clave", valor: (d) => comoTexto(claveDuplicado(d.invoice)) },
];

export function filaPlanilla(d: DatosFila): Celda[] {
  return COLUMNAS.map((c) => c.valor(d));
}

/** Letra de columna para un índice desde 0: 0 es A, 26 es AA. */
export function letraColumna(indice: number): string {
  let s = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
