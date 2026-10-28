import { facturaDePrueba } from "@/test/fixtures";
import { describe, expect, it } from "vitest";
import type { Factura } from "@/lib/invoice/schema";
import { aFactura, aValores, camposDe } from "./formulario";

const invoice: Factura = facturaDePrueba({ cuit_receptor: "20123456786", rubro: null, rubro_detalle: null, corresponde_a: null, campos_dudosos: ["total"], neto_gravado: 1000, iva_21: 210, total: 1210, cae: null });

describe("formulario de revisión", () => {
  it("ida y vuelta sin cambios devuelve la misma factura", () => {
    const r = aFactura(invoice, aValores(invoice), new Set());
    expect(r.success && r.data).toEqual(invoice);
  });

  it("convierte lo editado y conserva lo que no se edita", () => {
    const valores = { ...aValores(invoice), total: "1210.50", numero: "1235", corresponde_a: "HQ", iva_21: "" };
    const r = aFactura(invoice, valores, new Set(["total", "numero", "corresponde_a", "iva_21"] as const));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({ total: 1210.5, numero: 1235, corresponde_a: "HQ", iva_21: 0 });
    expect(r.data.cuit_receptor).toBe("20123456786");
    expect(r.data.tipo_cambio).toBeNull();
    expect(r.data.codigo_arca).toBe(1);
  });

  it("si cambia el tipo o la letra, borra el código ARCA leído", () => {
    const valores = { ...aValores(invoice), letra: "B" };
    const r = aFactura(invoice, valores, new Set(["letra"]));
    expect(r.success && r.data.codigo_arca).toBeNull();
  });

  it("muestra los campos de cada categoría", () => {
    const venta = camposDe("venta").map((c) => c.campo);
    expect(venta).toEqual(expect.arrayContaining(["cliente", "tipo_pago", "depto", "cuit_receptor"]));
    expect(venta).not.toContain("rubro");
    const compra = camposDe("compra").map((c) => c.campo);
    expect(compra).toEqual(expect.arrayContaining(["razon_social", "cuit", "rubro", "corresponde_a"]));
    expect(compra).not.toContain("cliente");
  });

  it("guarda los datos de una venta", () => {
    const valores = { ...aValores(invoice), categoria: "venta", cliente: "MARTÍN MIRANDA", depto: "1 A", tipo_pago: "" };
    const r = aFactura(invoice, valores, new Set(["categoria", "cliente", "depto", "tipo_pago"] as const));
    expect(r.success && r.data).toMatchObject({ categoria: "venta", cliente: "MARTÍN MIRANDA", depto: "1 A", tipo_pago: null });
  });

  it("rechaza números inválidos", () => {
    const r = aFactura(invoice, { ...aValores(invoice), total: "abc" }, new Set(["total"]));
    expect(r.success).toBe(false);
  });
});
