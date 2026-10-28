import { facturaDePrueba } from "../../test/fixtures";
import { describe, expect, it } from "vitest";
import type { Factura } from "../../lib/invoice/schema";
import {
  categoriaDeCarpeta,
  claveDeFila,
  historialDeFilas,
  compararFila,
  normalizarEncabezado,
  normalizeMoneda,
  normalizeRazonSocial,
  normalizeTipo,
  parseFecha,
  parseImporte,
  parseNumeroComprobante,
} from "./compare";

const inv: Factura = facturaDePrueba({ fecha_factura: "2026-09-15", punto_venta: 3, numero: 1234, concepto: "Cemento portland y arena gruesa", cuit_receptor: null, neto_gravado: 1234.56, iva_21: 259.26, total: 1493.82, cae: null });

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
  it("reconoce los encabezados de Administración Contable", () => {
    const egresos = ["Fecha de la Factura", "Nº Comprobante / Operación", "Rubro / Descripción", "Corresponde a", "IVA           21%",
      "Importe Neto Gravado", "Percepción IIBB Prov BSAS", "Importe Total"];
    expect(egresos.map(normalizarEncabezado)).toEqual(["fecha_factura", "numero", "rubro", "corresponde_a", "iva_21",
      "neto_gravado", "percepcion_iibb_pba", "total"]);
    const ingresos = ["Fecha Factura", "Nº Comprobante", "Cliente / Inversor / Razón Social", "Tipo de Pago", "CUIT Receptor",
      "Depto adquirido", "Importe ", "IVA           10,5%", "Comentario"];
    expect(ingresos.map(normalizarEncabezado)).toEqual(["fecha_factura", "numero", "cliente", "tipo_pago", "cuit_receptor",
      "depto", "importe_ventas", "iva_10_5", "concepto"]);
  });
  it("lee la categoría de la carpeta", () => {
    expect(categoriaDeCarpeta("Facturas Compras Octubre")).toBe("compra");
    expect(categoriaDeCarpeta("Facturas Ventas Octubre")).toBe("venta");
    expect(categoriaDeCarpeta("Facturas de Honorarios de Administración")).toBe("honorarios");
    expect(categoriaDeCarpeta("otras")).toBeNull();
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

  it("no compara la letra si la planilla no la tiene", () => {
    const nc = { ...inv, tipo_comprobante: "nota_credito" as const };
    expect(compararFila({ tipo_comprobante: "Nota de Crédito " }, nc, "coma").tipo_comprobante.acierto).toBe(true);
    expect(compararFila({ tipo_comprobante: "Nota de Crédito B" }, nc, "coma").tipo_comprobante.acierto).toBe(false);
    expect(compararFila({ tipo_comprobante: "Factura A" }, nc, "coma").tipo_comprobante.acierto).toBe(false);
  });

  it("compara las columnas de ventas", () => {
    const venta = { ...inv, categoria: "venta" as const, cliente: "MARTÍN MIRANDA", depto: "1 A", neto_gravado: 15169108.98 };
    const r = compararFila({ cliente: "MARTÍN MIRANDA", depto: "1-A", importe_ventas: "15,169,108.89" }, venta, "punto");
    expect(r.cliente.acierto).toBe(true);
    expect(r.depto.acierto).toBe(true);
    expect(r.importe_ventas.acierto).toBe(false);
  });

  it("arma la clave para emparejar sin columna archivo, igual que la de duplicados", () => {
    expect(claveDeFila(fila)).toBe("E|33693450239|FC|3|1234");
    expect(claveDeFila({ ...fila, tipo_comprobante: "Nota de Crédito " })).toBe("E|33693450239|NC|3|1234");
    expect(claveDeFila({ tipo_comprobante: "Factura A", numero: "00002-00000006", cliente: "MARTÍN MIRANDA", cuit_receptor: "30-71827792-9" })).toBe(
      "I|FC|2|6",
    );
  });

  it("arma el historial con las filas de las dos pestañas", () => {
    const h = historialDeFilas([fila, { cliente: "MARTÍN MIRANDA", cuit_receptor: "30-71827792-9", tipo_pago: "Amortización", depto: "1 A" }]);
    expect(h.egresos).toEqual([
      { fila: 2, cuit: "33693450239", razon_social: "CORRALON EJEMPLO SA", rubro: "", concepto: "Cemento y arena", corresponde_a: "" },
    ]);
    expect(h.ingresos).toEqual([{ fila: 3, cuit_receptor: "30718277929", cliente: "MARTÍN MIRANDA", tipo_pago: "Amortización", depto: "1 A" }]);
  });
});
