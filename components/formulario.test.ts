import { describe, expect, it } from "vitest";
import type { Invoice } from "@/lib/invoice/schema";
import { aFactura, aValores } from "./formulario";

const invoice: Invoice = {
  fecha_factura: "2026-09-15",
  tipo_comprobante: "factura",
  letra: "A",
  codigo_arca: 1,
  punto_venta: 3,
  numero: 1234,
  razon_social: "Corralón Ejemplo S.A.",
  cuit: "33693450239",
  cuit_receptor: "20123456786",
  concepto: "Cemento",
  moneda: "ARS",
  tipo_cambio: null,
  neto_gravado: 1000,
  no_gravado: 0,
  iva_21: 210,
  iva_10_5: 0,
  iva_otras: 0,
  percepcion_iva: 0,
  percepcion_iibb_caba: 0,
  percepcion_iibb_pba: 0,
  otros_tributos: 0,
  total: 1210,
  cae: null,
  cae_vencimiento: "2026-09-25",
  rubro: null,
  proyecto: null,
  campos_dudosos: ["total"],
  observaciones: null,
};

describe("formulario de revisión", () => {
  it("ida y vuelta sin cambios devuelve la misma factura", () => {
    const r = aFactura(invoice, aValores(invoice), new Set());
    expect(r.success && r.data).toEqual(invoice);
  });

  it("convierte lo editado y conserva lo que no se edita", () => {
    const valores = { ...aValores(invoice), total: "1210.50", numero: "1235", proyecto: "Güemes", iva_21: "" };
    const r = aFactura(invoice, valores, new Set(["total", "numero", "proyecto", "iva_21"]));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({ total: 1210.5, numero: 1235, proyecto: "Güemes", iva_21: 0 });
    expect(r.data.cuit_receptor).toBe("20123456786");
    expect(r.data.codigo_arca).toBe(1);
  });

  it("si cambia el tipo o la letra, borra el código ARCA leído", () => {
    const valores = { ...aValores(invoice), letra: "B" };
    const r = aFactura(invoice, valores, new Set(["letra"]));
    expect(r.success && r.data.codigo_arca).toBeNull();
  });

  it("rechaza números inválidos", () => {
    const r = aFactura(invoice, { ...aValores(invoice), total: "abc" }, new Set(["total"]));
    expect(r.success).toBe(false);
  });
});
