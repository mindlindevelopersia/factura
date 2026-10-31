import { describe, expect, it } from "vitest";
import { aDolares, brecha, deArgentinaDatos, deDolarApi } from "./dolar";

describe("dólar de hoy", () => {
  it("lee DolarApi: oficial, blue y MEP (bolsa)", () => {
    const r = deDolarApi([
      { moneda: "USD", casa: "oficial", nombre: "Oficial", compra: 1495, venta: 1545, fechaActualizacion: "2026-10-31T15:00:00.000Z" },
      { moneda: "USD", casa: "blue", nombre: "Blue", compra: 1540, venta: 1560, fechaActualizacion: "2026-10-31T15:00:00.000Z" },
      { moneda: "USD", casa: "bolsa", nombre: "Bolsa", compra: 1537.4, venta: 1557, fechaActualizacion: "2026-10-31T15:00:00.000Z" },
      { moneda: "USD", casa: "cripto", compra: 1, venta: 2 },
    ]);
    expect(r.map((c) => [c.casa, c.compra, c.venta])).toEqual([
      ["oficial", 1495, 1545],
      ["blue", 1540, 1560],
      ["mep", 1537.4, 1557],
    ]);
    expect(deDolarApi({ error: "x" })).toEqual([]);
  });

  it("lee la última de ArgentinaDatos", () => {
    const r = deArgentinaDatos("mep", [
      { casa: "bolsa", compra: 1500, venta: 1520, fecha: "2026-10-30" },
      { casa: "bolsa", compra: 1530, venta: 1557, fecha: "2026-10-31" },
      { casa: "bolsa", compra: 1400, venta: 1410, fecha: "2026-10-01" },
    ]);
    expect(r).toMatchObject({ casa: "mep", venta: 1557, fecha: "2026-10-31", fuente: "ArgentinaDatos" });
    expect(deArgentinaDatos("mep", [])).toBe(null);
  });

  it("pasa pesos a dólares al precio de venta y calcula la brecha", () => {
    expect(aDolares(1557000, { venta: 1557 })).toBe(1000);
    expect(aDolares(100, null)).toBe(null);
    const c = (venta: number) => ({ casa: "blue" as const, nombre: "", compra: null, venta, fecha: null, fuente: "" });
    expect(brecha(c(1560), c(1545))).toBeCloseTo(0.0097, 4);
  });
});
