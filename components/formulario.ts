import rubros from "@/config/rubros.json";
import { EMPRESA } from "@/lib/empresa";
import { CAMPOS_IMPORTE, FacturaSchema, LETRAS, MONEDAS, type Categoria, type Factura } from "@/lib/invoice/schema";

/** Campos de la ficha de revisión. Los que no están (código ARCA, vencimiento del CAE...) se conservan como los leyó la IA. */
export type CampoEditable = Exclude<keyof Factura, "codigo_arca" | "cae_vencimiento" | "campos_dudosos" | "observaciones">;

export interface DefCampo {
  campo: CampoEditable;
  etiqueta: string;
  tipo: "texto" | "fecha" | "entero" | "importe" | "opciones";
  opciones?: { valor: string; texto: string }[];
  ancho?: boolean;
  /** Solo se muestra para estas categorías. Sin esto, para todas. */
  solo?: readonly Categoria[];
}

const vacio = { valor: "", texto: "—" };
const lista = (valores: readonly string[]) => [vacio, ...valores.map((v) => ({ valor: v, texto: v }))];
const EGRESOS: readonly Categoria[] = ["compra", "honorarios"];
const VENTAS: readonly Categoria[] = ["venta"];

export const ETIQUETAS_IMPORTE: Record<(typeof CAMPOS_IMPORTE)[number] | "total", string> = {
  neto_gravado: "Neto gravado",
  no_gravado: "No gravado / exento",
  iva_21: "IVA 21%",
  iva_10_5: "IVA 10,5%",
  iva_otras: "IVA otras alícuotas",
  percepcion_iva: "Percepciones IVA",
  percepcion_iibb_caba: "IIBB CABA",
  percepcion_iibb_pba: "IIBB PBA",
  otros_tributos: "Otros tributos",
  total: "Total",
};

export const CAMPOS: DefCampo[] = [
  {
    campo: "categoria",
    etiqueta: "Categoría",
    tipo: "opciones",
    opciones: [
      { valor: "compra", texto: "Compra" },
      { valor: "honorarios", texto: "Honorarios de administración" },
      { valor: "venta", texto: "Venta" },
    ],
  },
  { campo: "fecha_factura", etiqueta: "Fecha", tipo: "fecha" },
  {
    campo: "tipo_comprobante",
    etiqueta: "Tipo",
    tipo: "opciones",
    opciones: [
      { valor: "factura", texto: "Factura" },
      { valor: "nota_credito", texto: "Nota de crédito" },
      { valor: "nota_debito", texto: "Nota de débito" },
      { valor: "liquidacion", texto: "Liquidación" },
      { valor: "recibo", texto: "Recibo" },
      { valor: "ticket", texto: "Ticket" },
      { valor: "otro", texto: "Otro" },
    ],
  },
  { campo: "letra", etiqueta: "Letra", tipo: "opciones", opciones: lista(LETRAS) },
  { campo: "punto_venta", etiqueta: "Punto de venta", tipo: "entero" },
  { campo: "numero", etiqueta: "Número", tipo: "entero" },
  { campo: "razon_social", etiqueta: "Razón social", tipo: "texto", ancho: true, solo: EGRESOS },
  { campo: "cuit", etiqueta: "CUIT", tipo: "texto", solo: EGRESOS },
  { campo: "cliente", etiqueta: "Cliente / inversor", tipo: "texto", ancho: true, solo: VENTAS },
  { campo: "cuit_receptor", etiqueta: "CUIT receptor", tipo: "texto" },
  { campo: "tipo_pago", etiqueta: "Tipo de pago", tipo: "texto", solo: VENTAS },
  { campo: "depto", etiqueta: "Depto adquirido", tipo: "texto", solo: VENTAS },
  { campo: "cae", etiqueta: "CAE", tipo: "texto" },
  { campo: "concepto", etiqueta: "Concepto", tipo: "texto", ancho: true },
  rubros.length > 0
    ? { campo: "rubro", etiqueta: "Rubro", tipo: "opciones", opciones: lista(rubros), solo: EGRESOS }
    : { campo: "rubro", etiqueta: "Rubro", tipo: "texto", solo: EGRESOS },
  { campo: "corresponde_a", etiqueta: "Corresponde a", tipo: "opciones", opciones: lista(EMPRESA.corresponde_a), solo: EGRESOS },
  { campo: "moneda", etiqueta: "Moneda", tipo: "opciones", opciones: MONEDAS.map((m) => ({ valor: m, texto: m === "otra" ? "Otra" : m })) },
  ...Object.entries(ETIQUETAS_IMPORTE).map(([campo, etiqueta]) => ({ campo: campo as CampoEditable, etiqueta, tipo: "importe" as const })),
];

/** Los campos que se muestran para una categoría. */
export function camposDe(categoria: string): DefCampo[] {
  return CAMPOS.filter((d) => !d.solo || d.solo.includes(categoria as Categoria));
}

export type Valores = Record<CampoEditable, string>;

export function aValores(f: Factura): Valores {
  const v = {} as Valores;
  for (const { campo } of CAMPOS) {
    const valor = f[campo];
    v[campo] = valor == null ? "" : String(valor);
  }
  return v;
}

const NULABLES = new Set<CampoEditable>([
  "letra",
  "cuit",
  "cuit_receptor",
  "cae",
  "rubro",
  "corresponde_a",
  "cliente",
  "tipo_pago",
  "depto",
]);

/**
 * Arma la factura con lo que editó la persona. Si cambió el tipo o la letra, el código
 * ARCA que leyó la IA ya no vale: se borra y se deduce del tipo y la letra.
 */
export function aFactura(original: Factura, valores: Valores, tocados: ReadonlySet<CampoEditable>) {
  const datos: Record<string, unknown> = { ...original };
  for (const { campo, tipo } of CAMPOS) {
    const s = valores[campo].trim();
    if (tipo === "entero") datos[campo] = s === "" ? null : Number(s);
    else if (tipo === "importe") datos[campo] = s === "" ? 0 : Number(s.replace(",", "."));
    else datos[campo] = s === "" && NULABLES.has(campo) ? null : s;
  }
  if (tocados.has("tipo_comprobante") || tocados.has("letra")) datos.codigo_arca = null;
  return FacturaSchema.safeParse(datos);
}
