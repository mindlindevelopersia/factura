import { z } from "zod";

/**
 * Esquema de los datos que la IA extrae de un comprobante, de compra o de venta.
 *
 * Sigue las columnas de las pestañas de Facturación de Egresos e Ingresos de la
 * planilla Administración Contable. No incluye lo que se completa después de cargar
 * la factura (fecha de registro, forma de pago, banco, retención de ganancias, monto
 * a transferir, comprobante de retención, link a Drive): eso lo pone la app o el
 * equipo, no la IA.
 */

export const TIPOS_COMPROBANTE = [
  "factura",
  "nota_credito",
  "nota_debito",
  "recibo",
  "ticket",
  "liquidacion",
  "otro",
] as const;
export type TipoComprobante = (typeof TIPOS_COMPROBANTE)[number];

export const LETRAS = ["A", "B", "C", "M", "E"] as const;
export type Letra = (typeof LETRAS)[number];

export const MONEDAS = ["ARS", "USD", "EUR", "otra"] as const;
export type Moneda = (typeof MONEDAS)[number];

/**
 * Las tres carpetas en las que el equipo ordena los comprobantes. Los honorarios
 * son las facturas que los socios le hacen a la sociedad: van a la planilla de
 * egresos como una compra, pero se guardan en su propia carpeta.
 */
export const CATEGORIAS = ["compra", "honorarios", "venta"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Importes que suman el total. El control de suma usa esta lista. */
export const CAMPOS_IMPORTE = [
  "neto_gravado",
  "no_gravado",
  "iva_21",
  "iva_10_5",
  "iva_otras",
  "percepcion_iva",
  "percepcion_iibb_caba",
  "percepcion_iibb_pba",
  "otros_tributos",
] as const;
export type CampoImporte = (typeof CAMPOS_IMPORTE)[number];

/** Campos que la IA o los controles pueden marcar como dudosos (en amarillo). */
export const CAMPOS_FACTURA = [
  "fecha_factura",
  "tipo_comprobante",
  "letra",
  "codigo_arca",
  "punto_venta",
  "numero",
  "razon_social",
  "cuit",
  "cuit_receptor",
  "razon_social_receptor",
  "concepto",
  "moneda",
  "tipo_cambio",
  ...CAMPOS_IMPORTE,
  "total",
  "cae",
  "cae_vencimiento",
  "rubro",
  "corresponde_a",
] as const;
export type CampoFactura = (typeof CAMPOS_FACTURA)[number];

const importe = (descripcion: string) =>
  z.number().describe(`${descripcion}. 0 si no figura.`);

export const InvoiceSchema = z.object({
  fecha_factura: z.string().describe("Fecha de emisión en formato AAAA-MM-DD."),
  tipo_comprobante: z.enum(TIPOS_COMPROBANTE),
  letra: z.enum(LETRAS).nullable().describe("Letra del comprobante. null si no tiene."),
  codigo_arca: z
    .number()
    .int()
    .nullable()
    .describe('Código de tipo de comprobante de ARCA si está impreso (por ejemplo "COD. 001" es 1). null si no figura.'),
  punto_venta: z.number().int().nullable().describe("Punto de venta, sin ceros a la izquierda."),
  numero: z.number().int().nullable().describe("Número de comprobante, sin el punto de venta."),
  razon_social: z.string().describe("Razón social del emisor: el proveedor en una compra, Mindlin en una venta."),
  cuit: z.string().nullable().describe("CUIT del emisor: 11 dígitos, sin guiones ni espacios."),
  cuit_receptor: z
    .string()
    .nullable()
    .describe("CUIT del receptor (a quien va dirigida la factura): 11 dígitos, sin guiones."),
  razon_social_receptor: z.string().nullable().describe("Razón social o nombre del receptor. null si no figura."),
  concepto: z.string().describe("Lo facturado en pocas palabras, como se anota en la planilla."),
  moneda: z.enum(MONEDAS),
  tipo_cambio: z.number().nullable().describe("Tipo de cambio si el comprobante lo informa. null si no."),
  neto_gravado: importe("Importe neto gravado"),
  no_gravado: importe("Importe no gravado más exento, o el importe sin IVA discriminado"),
  iva_21: importe("IVA al 21%"),
  iva_10_5: importe("IVA al 10,5%"),
  iva_otras: importe("IVA a otras alícuotas (27%, 5%, 2,5%), sumado"),
  percepcion_iva: importe("Percepción de IVA"),
  percepcion_iibb_caba: importe("Percepción de Ingresos Brutos de CABA"),
  percepcion_iibb_pba: importe("Percepción de Ingresos Brutos de Provincia de Buenos Aires"),
  otros_tributos: importe("Otros tributos: percepciones de otras provincias, impuestos internos, etc."),
  total: z.number().describe("Importe total del comprobante."),
  cae: z.string().nullable().describe("CAE o CAI, solo dígitos. null si no figura."),
  cae_vencimiento: z.string().nullable().describe("Vencimiento del CAE en formato AAAA-MM-DD. null si no figura."),
  rubro: z.string().nullable().describe("Rubro de gasto propuesto. null en las ventas."),
  corresponde_a: z
    .string()
    .nullable()
    .describe("A qué corresponde el gasto (la obra o la oficina). null en las ventas o si no hay pistas."),
  campos_dudosos: z
    .array(z.enum(CAMPOS_FACTURA))
    .describe("Campos ilegibles, ambiguos o inferidos que una persona tiene que revisar."),
  observaciones: z.string().nullable().describe("Algo que la persona que revisa deba saber. null si no hay nada."),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

/** Lista cerrada para la IA, o el campo libre del esquema base si la lista está vacía. */
function deLaLista(valores: readonly string[], libre: z.ZodNullable<z.ZodString>, descripcion: string) {
  if (valores.length === 0) return libre;
  return z
    .enum(valores as [string, ...string[]])
    .nullable()
    .describe(descripcion);
}

/** Esquema para la IA, con el rubro y "corresponde a" limitados a sus listas cuando las hay. */
export function buildInvoiceSchema(rubros: readonly string[] = [], correspondeA: readonly string[] = []) {
  return InvoiceSchema.extend({
    rubro: deLaLista(rubros, InvoiceSchema.shape.rubro, "Rubro de gasto, de la lista. null en las ventas o si ninguno corresponde."),
    corresponde_a: deLaLista(
      correspondeA,
      InvoiceSchema.shape.corresponde_a,
      "A qué corresponde el gasto, de la lista. null en las ventas o si no hay pistas.",
    ),
  });
}

/**
 * Lo que se carga en la planilla: lo que leyó la IA más lo que agrega la app (la
 * categoría y, en las ventas, los datos que salen de la carga anterior del mismo cliente).
 */
export const FacturaSchema = InvoiceSchema.extend({
  categoria: z.enum(CATEGORIAS),
  /** Ventas: columna "Cliente / Inversor / Razón Social". */
  cliente: z.string().nullable(),
  /** Ventas: columna "Tipo de Pago". */
  tipo_pago: z.string().nullable(),
  /** Ventas: columna "Depto adquirido". */
  depto: z.string().nullable(),
});

export type Factura = z.infer<typeof FacturaSchema>;
