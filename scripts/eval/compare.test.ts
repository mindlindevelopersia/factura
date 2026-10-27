import { describe, expect, it } from "vitest";
import type { Invoice } from "../../lib/invoice/schema";
import {
  claveDeFila,
  compararFila,
  normalizarEncabezado,
  normalizeMoneda,
  normalizeRazonSocial,
  normalizeTipo,
  parseFecha,
  parseImporte,
  parseNumeroComprobante,
} from "./compare";

const inv: Invoice = {
  fecha_factura: "2026-09-15",
  tipo_comprobante: "factura",
  letra: "A",
  codigo_arca: 1,
  punto_venta: 3,
  numero: 1234,
  razon_social: "Corralón Ejemplo S.A.",
  cuit: "33693450239",
  cuit_receptor: null,
  concepto: "Cemento portland y arena gruesa",
  moneda: "ARS",
  tipo_cambio: null,
  neto_gravado: 1234.56,
  no_gravado: 0,
  iva_21: 259.26,
  iva_10_5: 0,
  iva_otras: 0,
  percepcion_iva: 0,
  percepcion_iibb_caba: 0,
  percepcion_iibb_pba: 0,
  otros_tributos: 0,
  total: 1493.82,
  cae: null,
  cae_vencimiento: null,
  rubro: "Materiales",
  proyecto: "Lerma",
  campos_dudosos: [],
  observaciones: null,
};

describe("normalización", () => {
  it("lee importes con decimal coma o punto", () => {
    expect(parseImporte("$ 1.234,56", "coma")).toBe(1234.56);
    expect(parseImporte("1,234.56", "punto")).toBe(1234.56);
    expect(parseImporte("-500", "coma")).toBe(-500);
    expect(parseImporte("", "coma")).toBeNull();
  });
  it("lee fechas", () => {
    expect(parseFecha("15/09/2026")).toBe("2026-09-15");
    expect(parseFecha("5/9/26")).toBe("2026-09-05");
    expect(parseFecha("2026-09-15")).toBe("2026-09-15");
  });
  it("normaliza tipos, monedas y razones sociales", () => {
    expect(normalizeTipo("FC A")).toBe("factura a");
    expect(normalizeTipo("Nota de Crédito B")).toBe("nota de credito b");
    expect(normalizeTipo("NC-B")).toBe("nota de credito b");
    expect(normalizeMoneda("U$S")).toBe("USD");
    expect(normalizeMoneda("$")).toBe("ARS");
    expect(normalizeRazonSocial("CORRALON EJEMPLO SA")).toBe(normalizeRazonSocial("Corralón Ejemplo S.A."));
  });
  it("separa punto de venta y número", () => {
    expect(parseNumeroComprobante("0003-00001234")).toEqual([3, 1234]);
    expect(parseNumeroComprobante("1234")).toEqual([null, 1234]);
  });
  it("reconoce los encabezados de la planilla", () => {
    expect(normalizarEncabezado("N°")).toBe("numero");
    expect(normalizarEncabezado("IVA 10,5%")).toBe("iva_10_5");
    expect(normalizarEncabezado("Percepciones IIBB CABA")).toBe("percepcion_iibb_caba");
    expect(normalizarEncabezado("Razón social")).toBe("razon_social");
  });
});

describe("compararFila", () => {
  const fila = {
    fecha_factura: "15/09/2026",
    tipo_comprobante: "Factura A",
    numero: "0003-00001234",
    razon_social: "CORRALON EJEMPLO SA",
    cuit: "33-69345023-9",
    concepto: "Cemento y arena",
    neto_gravado: "1.234,56",
    iva_21: "259,26",
    iva_10_5: "",
    total: "1.493,82",
    rubro: "",
  };

  it("acierta todos los campos de una fila correcta y no compara los vacíos", () => {
    const r = compararFila(fila, inv, "coma");
    expect(r.rubro.acierto).toBeNull();
    const fallados = Object.entries(r).filter(([, c]) => c.acierto === false);
    expect(fallados).toEqual([]);
  });

  it("detecta diferencias", () => {
    const r = compararFila({ ...fila, total: "1.500,00", numero: "0004-00001234" }, inv, "coma");
    expect(r.total.acierto).toBe(false);
    expect(r.numero.acierto).toBe(false);
  });

  it("arma la clave para emparejar sin columna archivo", () => {
    expect(claveDeFila(fila)).toBe("33693450239|3|1234");
  });
});
