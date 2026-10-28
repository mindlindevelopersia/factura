import type { CampoImporte, Factura } from "../invoice/schema";
import { formatNumero, formatTipo } from "../invoice/tipos";
import { normalizeCuit } from "../validation/cuit";

export interface DatosFila {
  factura: Factura;
  /** AAAA-MM-DD */
  fechaRegistro: string;
  link: string | null;
}

/** null deja la celda como está: son las columnas que completa el equipo (forma de pago, banco, retención...). */
export type Celda = string | number | null;

export interface Columna {
  titulo: string;
  valor: (d: DatosFila) => Celda;
}

/**
 * Texto que viene de la factura. Si empieza con =, +, - o @, Sheets lo tomaría como
 * fórmula: el apóstrofo lo fuerza a texto (y evita que una factura meta fórmulas).
 */
function texto(s: string | null | undefined): string {
  if (!s) return "";
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function cuitConGuiones(cuit: string | null): string {
  if (!cuit) return "";
  const d = normalizeCuit(cuit);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : texto(cuit);
}

/** Las notas de crédito restan: sus importes van en negativo. Un importe en 0 deja la celda vacía, como en la planilla. */
function importe(obtener: (f: Factura) => number) {
  return ({ factura }: DatosFila): Celda => {
    const valor = obtener(factura);
    if (valor === 0) return "";
    return factura.tipo_comprobante === "nota_credito" ? -valor : valor;
  };
}

const campo = (c: CampoImporte | "total") => importe((f) => f[c]);

const MONEDAS: Record<Factura["moneda"], string> = { ARS: "Pesos", USD: "Dólares", EUR: "Euros", otra: "Otra" };

const nada = () => null;

/**
 * Pestaña "Facturación de Egresos (Compras)", columnas A a Y, en el orden de la planilla.
 * Las compras y los honorarios de los socios van acá.
 *
 * La planilla no tiene columnas para el IVA a otras alícuotas ni para otros tributos: si una
 * factura los tiene, quedan dentro del total (la pantalla de revisión avisa).
 */
export const COLUMNAS_EGRESOS: Columna[] = [
  { titulo: "Fecha de la Factura", valor: (d) => d.factura.fecha_factura },
  { titulo: "Fecha de Registro", valor: (d) => d.fechaRegistro },
  { titulo: "Tipo de Comprobante", valor: (d) => formatTipo(d.factura) },
  { titulo: "Nº Comprobante / Operación", valor: (d) => formatNumero(d.factura) ?? texto(String(d.factura.numero ?? "")) },
  { titulo: "Razón Social", valor: (d) => texto(d.factura.razon_social) },
  { titulo: "Rubro / Descripción", valor: (d) => texto(d.factura.rubro) },
  { titulo: "CUIT", valor: (d) => cuitConGuiones(d.factura.cuit) },
  { titulo: "Concepto", valor: (d) => texto(d.factura.concepto) },
  { titulo: "Corresponde a", valor: (d) => texto(d.factura.corresponde_a) },
  { titulo: "Forma de Pago", valor: nada },
  { titulo: "Banco del que Salió", valor: nada },
  { titulo: "Moneda", valor: (d) => MONEDAS[d.factura.moneda] },
  { titulo: "Importe Neto Gravado", valor: campo("neto_gravado") },
  { titulo: "Importe No Gravado", valor: campo("no_gravado") },
  { titulo: "IVA 21%", valor: campo("iva_21") },
  { titulo: "IVA 10,5%", valor: campo("iva_10_5") },
  { titulo: "Percepción IVA", valor: campo("percepcion_iva") },
  { titulo: "Percepción IIBB CABA", valor: campo("percepcion_iibb_caba") },
  { titulo: "Percepción IIBB Prov BSAS", valor: campo("percepcion_iibb_pba") },
  { titulo: "Importe Total", valor: campo("total") },
  { titulo: "Retención Impuesto a las Ganancias", valor: nada },
  // La app escribe la fórmula =T-U de la planilla una vez que sabe el número de fila.
  { titulo: "Monto a Transferir", valor: nada },
  { titulo: "Comprobante Retención", valor: nada },
  { titulo: "Factura", valor: (d) => d.link ?? "" },
  { titulo: "Pago?", valor: nada },
];

/** Pestaña "Facturación de Ingresos (Ventas)", columnas A a O, en el orden de la planilla. */
export const COLUMNAS_INGRESOS: Columna[] = [
  { titulo: "Fecha Factura", valor: (d) => d.factura.fecha_factura },
  { titulo: "Fecha de Registro", valor: (d) => d.fechaRegistro },
  { titulo: "Tipo", valor: (d) => formatTipo(d.factura) },
  { titulo: "Nº Comprobante", valor: (d) => formatNumero(d.factura) ?? texto(String(d.factura.numero ?? "")) },
  { titulo: "Cliente / Inversor / Razón Social", valor: (d) => texto(d.factura.cliente ?? d.factura.razon_social_receptor) },
  { titulo: "Tipo de Pago", valor: (d) => texto(d.factura.tipo_pago) },
  { titulo: "CUIT Receptor", valor: (d) => cuitConGuiones(d.factura.cuit_receptor) },
  { titulo: "Depto adquirido", valor: (d) => texto(d.factura.depto) },
  { titulo: "Moneda", valor: (d) => MONEDAS[d.factura.moneda] },
  { titulo: "Importe", valor: importe((f) => f.neto_gravado + f.no_gravado) },
  { titulo: "IVA 10,5%", valor: campo("iva_10_5") },
  { titulo: "IVA 21%", valor: campo("iva_21") },
  { titulo: "Importe Total", valor: campo("total") },
  { titulo: "Link", valor: (d) => d.link ?? "" },
  { titulo: "Comentario", valor: (d) => texto(d.factura.concepto) },
];

export type Pestania = "egresos" | "ingresos";

export function pestaniaDe(f: Pick<Factura, "categoria">): Pestania {
  return f.categoria === "venta" ? "ingresos" : "egresos";
}

export const COLUMNAS: Record<Pestania, Columna[]> = { egresos: COLUMNAS_EGRESOS, ingresos: COLUMNAS_INGRESOS };

export function filaPlanilla(d: DatosFila): Celda[] {
  return COLUMNAS[pestaniaDe(d.factura)].map((c) => c.valor(d));
}

/** Índice (desde 0) de la columna con ese título. */
export function indiceColumna(pestania: Pestania, titulo: string): number {
  const i = COLUMNAS[pestania].findIndex((c) => c.titulo === titulo);
  if (i < 0) throw new Error(`No hay una columna "${titulo}" en ${pestania}`);
  return i;
}

/** Letra de columna para un índice desde 0: 0 es A, 26 es AA. */
export function letraColumna(indice: number): string {
  let s = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const SIN_COLUMNA: Record<Pestania, CampoImporte[]> = {
  egresos: ["iva_otras", "otros_tributos"],
  ingresos: ["iva_otras", "percepcion_iva", "percepcion_iibb_caba", "percepcion_iibb_pba", "otros_tributos"],
};

/** Importes de la factura que no tienen columna en su pestaña: solo quedan dentro del total. */
export function importesSinColumna(f: Factura): CampoImporte[] {
  return SIN_COLUMNA[pestaniaDe(f)].filter((c) => f[c] !== 0);
}
