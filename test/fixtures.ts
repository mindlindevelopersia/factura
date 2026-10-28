import type { Factura, Invoice } from "../lib/invoice/schema";

/**
 * Comprobantes de prueba. Los nombres y los CUIT son inventados (con dígito verificador
 * válido); solo el de Mindlin es real. Los datos del cliente no van al repo.
 */
export const CUIT_MINDLIN = "30718811550";
export const CORRALON = { razon_social: "Corralón Ejemplo S.A.", cuit: "33693450239" };
export const CONSTRUCTORA = { razon_social: "Constructora Ejemplo S.R.L.", cuit: "30712345671" };
export const ARQUITECTA = { razon_social: "PEREZ ANA", cuit: "27987654320" };
export const SOCIO = { razon_social: "GOMEZ JUAN", cuit: "20333333334" };

/** Lo que leería la IA de una factura A de materiales. */
export function invoiceDePrueba(cambios: Partial<Invoice> = {}): Invoice {
  return {
    fecha_factura: "2026-10-01",
    tipo_comprobante: "factura",
    letra: "A",
    codigo_arca: 1,
    punto_venta: 5,
    numero: 25853,
    razon_social: CORRALON.razon_social,
    cuit: CORRALON.cuit,
    cuit_receptor: CUIT_MINDLIN,
    razon_social_receptor: "MINDLIN DEVELOPERS SA",
    concepto: "Cemento",
    moneda: "ARS",
    tipo_cambio: null,
    neto_gravado: 37306.01,
    no_gravado: 0,
    iva_21: 7834.26,
    iva_10_5: 0,
    iva_otras: 0,
    percepcion_iva: 0,
    percepcion_iibb_caba: 0,
    percepcion_iibb_pba: 0,
    otros_tributos: 0,
    total: 45140.27,
    cae: "86405562470534",
    cae_vencimiento: "2026-10-11",
    rubro: "Materiales",
    rubro_detalle: "Materiales de construcción",
    corresponde_a: "Lerma 439",
    campos_dudosos: [],
    observaciones: null,
    ...cambios,
  };
}

/** La misma factura, ya completada por la app como compra. */
export function facturaDePrueba(cambios: Partial<Factura> = {}): Factura {
  return { ...invoiceDePrueba(), categoria: "compra", cliente: null, tipo_pago: null, depto: null, ...cambios };
}

/** Una venta de Mindlin: certificación de obra pagada con una unidad (canje). */
export function ventaDePrueba(cambios: Partial<Factura> = {}): Factura {
  return facturaDePrueba({
    fecha_factura: "2026-10-06",
    punto_venta: 2,
    numero: 6,
    razon_social: "MINDLIN DEVELOPERS",
    cuit: CUIT_MINDLIN,
    cuit_receptor: CONSTRUCTORA.cuit,
    razon_social_receptor: CONSTRUCTORA.razon_social,
    concepto: "Certificación 15",
    neto_gravado: 15169108.98,
    iva_21: 0,
    iva_10_5: 1592756.44,
    total: 16761865.42,
    rubro: null,
    rubro_detalle: null,
    corresponde_a: null,
    categoria: "venta",
    cliente: "INVERSOR EJEMPLO",
    tipo_pago: "Amortización",
    depto: "1 A",
    ...cambios,
  });
}
