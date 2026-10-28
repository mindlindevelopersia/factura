import rubros from "@/config/rubros.json";
import {
  CAMPOS_IMPORTE,
  InvoiceSchema,
  LETRAS,
  MONEDAS,
  PROYECTOS,
  type CampoFactura,
  type Invoice,
} from "@/lib/invoice/schema";

/** Campos de la ficha de revisión. Los que no están (CUIT receptor, vencimiento del CAE) se conservan como los leyó la IA. */
export type CampoEditable = Exclude<CampoFactura, "codigo_arca" | "cuit_receptor" | "cae_vencimiento">;

export interface DefCampo {
  campo: CampoEditable;
  etiqueta: string;
  tipo: "texto" | "fecha" | "entero" | "importe" | "opciones";
  opciones?: { valor: string; texto: string }[];
  ancho?: boolean;
}

const vacio = { valor: "", texto: "—" };

const IMPORTES: Record<(typeof CAMPOS_IMPORTE)[number] | "total", string> = {
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
  { campo: "fecha_factura", etiqueta: "Fecha", tipo: "fecha" },
  {
    campo: "tipo_comprobante",
    etiqueta: "Tipo",
    tipo: "opciones",
    opciones: [
      { valor: "factura", texto: "Factura" },
      { valor: "nota_credito", texto: "Nota de crédito" },
      { valor: "nota_debito", texto: "Nota de débito" },
      { valor: "recibo", texto: "Recibo" },
      { valor: "ticket", texto: "Ticket" },
      { valor: "otro", texto: "Otro" },
    ],
  },
  { campo: "letra", etiqueta: "Letra", tipo: "opciones", opciones: [vacio, ...LETRAS.map((l) => ({ valor: l, texto: l }))] },
  { campo: "punto_venta", etiqueta: "Punto de venta", tipo: "entero" },
  { campo: "numero", etiqueta: "Número", tipo: "entero" },
  { campo: "razon_social", etiqueta: "Razón social", tipo: "texto", ancho: true },
  { campo: "cuit", etiqueta: "CUIT", tipo: "texto" },
  { campo: "cae", etiqueta: "CAE", tipo: "texto" },
  { campo: "concepto", etiqueta: "Concepto", tipo: "texto", ancho: true },
  rubros.length > 0
    ? { campo: "rubro", etiqueta: "Rubro", tipo: "opciones", opciones: [vacio, ...rubros.map((r: string) => ({ valor: r, texto: r }))] }
    : { campo: "rubro", etiqueta: "Rubro", tipo: "texto" },
  { campo: "proyecto", etiqueta: "Proyecto", tipo: "opciones", opciones: [vacio, ...PROYECTOS.map((p) => ({ valor: p, texto: p }))] },
  { campo: "moneda", etiqueta: "Moneda", tipo: "opciones", opciones: MONEDAS.map((m) => ({ valor: m, texto: m === "otra" ? "Otra" : m })) },
  { campo: "tipo_cambio", etiqueta: "Tipo de cambio", tipo: "importe" },
  ...Object.entries(IMPORTES).map(([campo, etiqueta]) => ({ campo: campo as CampoEditable, etiqueta, tipo: "importe" as const })),
];

export type Valores = Record<CampoEditable, string>;

export function aValores(inv: Invoice): Valores {
  const v = {} as Valores;
  for (const { campo } of CAMPOS) {
    const valor = inv[campo];
    v[campo] = valor == null ? "" : String(valor);
  }
  return v;
}

const NULABLES = new Set<CampoEditable>(["letra", "cuit", "cae", "rubro", "proyecto"]);

/**
 * Arma la factura con lo que editó la persona. Si cambió el tipo o la letra, el código
 * ARCA que leyó la IA ya no vale: se borra y se deduce del tipo y la letra.
 */
export function aFactura(original: Invoice, valores: Valores, tocados: ReadonlySet<CampoEditable>) {
  const datos: Record<string, unknown> = { ...original };
  for (const { campo, tipo } of CAMPOS) {
    const s = valores[campo].trim();
    if (tipo === "entero") datos[campo] = s === "" ? null : Number(s);
    else if (tipo === "importe") datos[campo] = s === "" ? (campo === "tipo_cambio" ? null : 0) : Number(s.replace(",", "."));
    else datos[campo] = s === "" && NULABLES.has(campo) ? null : s;
  }
  if (tocados.has("tipo_comprobante") || tocados.has("letra")) datos.codigo_arca = null;
  return InvoiceSchema.safeParse(datos);
}
