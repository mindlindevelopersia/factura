import { describe, expect, it } from "vitest";
import { actualizado, cashFlowReal, leerCashFlowMadre, mepDeSerie, proyectadoEnPesos, rangoDeMeses, totales } from "./cashflow";
import type { Egreso } from "./egresos";
import type { Celda } from "./ingresos";

const c = (valor: number | string | null): Celda => ({ valor, color: null as never });
const fila = (...v: (number | string | null)[]) => v.map(c);
// Abril, mayo y junio de 2025 como números de serie de Sheets.
const serie = (iso: string) => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, 1) - Date.UTC(1899, 11, 30)) / 86_400_000);
const grilla: Celda[][] = [
  fila("ID", "%", "TOTAL", null, serie("2025-04"), serie("2025-05"), serie("2025-06"), serie("2025-07"), serie("2025-08"), serie("2025-09")),
  fila("INGRESOS C/IVA en DÓLARES"),
  fila("Anticipos", null, 1000, null, 1000, "0", 0, 0, 0, 0),
  fila("Cuotas mensuales", null, 300, null, 0, 100, 100, 100, 0, 0),
  fila("Total Ingresos con IVA en DÓLARES", null, 1300, null, 1000, 100, 100, 100, 0, 0),
  fila("EGRESOS C/IVA en DÓLARES"),
  fila("TOTAL EGRESOS C/IVA", null, "Total proyectado"),
  fila("Terreno"),
  fila("Valor del terreno", null, 500, 500, 500, 0, 0, 0, 0, 0),
  fila("Costo Total Terreno", null, 500),
  fila("Hard Costs - Construcción"),
  fila("Obra general"),
  fila("Albañilería", 0.1, 200, 200, 0, 100, 100, 0, 0, 0),
  fila("Hipoteca", null, 0, null, 0, 0, 0, 0, 0, 0),
  fila("Hard Costs Total", null, 200),
  fila("Total Egresos Mensuales con IVA", null, 700, null, 500, 100, 100, 0, 0, 0),
  fila(" IVA Total en DÓLARES", null, -10, null, 0, -10, 0, 0, 0, 0),
  fila("RESULTADO por Período", null, 590, null, 500, -10, 0, 100, 0, 0),
];

describe("cash flow", () => {
  it("lee el proyectado del Excel madre por grupos, sin subtotales ni filas en cero", () => {
    const r = leerCashFlowMadre(grilla);
    expect(r.meses).toEqual(["2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09"]);
    expect(r.partidas.map((p) => [p.nombre, p.grupo])).toEqual([
      ["Anticipos", "anticipos"],
      ["Cuotas mensuales", "cuotas"],
      ["Valor del terreno", "terreno"],
      ["Albañilería", "obra"],
      ["IVA (débito − crédito)", "iva"],
    ]);
    expect(r.avisos).toEqual([]);
    const t = totales(r.partidas, r.meses, "USD");
    expect(t.neto["2025-04"]).toBe(500);
    expect(t.neto["2025-05"]).toBe(-10);
    expect(t.acumulado["2025-09"]).toBe(590);
  });

  it("avisa si no da igual que el resultado de la planilla", () => {
    const mala = grilla.map((f) => (f[0].valor === "RESULTADO por Período" ? fila("RESULTADO por Período", null, 0, null, 999) : f));
    expect(leerCashFlowMadre(mala).avisos[0]).toContain("no da igual");
  });

  it("el MEP del día (o el último antes) y el de hoy para lo que viene", () => {
    const mep = mepDeSerie([{ fecha: "2025-04-10", venta: 1000 }, { fecha: "2025-05-02", venta: 1100 }, { fecha: "2025-12-31", venta: 1400 }], 1500);
    expect(mep("2025-04-20")).toBe(1000);
    expect(mep("2025-05")).toBe(1100);
    expect(mep("2025-01-01")).toBe(1000);
    expect(mep("2026-01")).toBe(1500);
    const p = proyectadoEnPesos(leerCashFlowMadre(grilla).partidas, mep);
    expect(p[0].ars["2025-04"]).toBe(1_000_000);
  });

  it("lo real: cobros por tipo y egresos en los grupos del Excel, al MEP del día", () => {
    const mep = mepDeSerie([{ fecha: "2025-05-01", venta: 1000 }, { fecha: "2025-12-31", venta: 1300 }], 1200);
    const egreso = (rubro: Egreso["rubro"], monto: number, moneda: Egreso["moneda"] = "ARS"): Egreso => ({ fecha: "2025-05-10", mes: "2025-05", descripcion: "Algo inventado", categoria: "", rubro, proyecto: "Lerma 439", bn: null, moneda, monto, forma: "", banco: "", pestania: "Caja", fila: 2 });
    const r = cashFlowReal({
      cobros: [
        { fecha: "2025-05-05", moneda: "ARS", monto: 200000, concepto: "Cuota 3", formal: true, inversor: "Persona Inventada", unidad: "3B" },
        { fecha: "2025-05-06", moneda: "USD", monto: 5000, concepto: "Refuerzo", formal: false, inversor: "Persona Inventada", unidad: "3B" },
        { fecha: "2025-05-07", moneda: "USD", monto: 1000, concepto: "Aporte inicial", formal: true, inversor: "Persona Inventada", unidad: "3B" },
      ],
      egresos: [egreso("hormigon", 100000), egreso("honorarios", 50, "USD"), egreso("prestamos", 1000)],
      nombreRubro: (id) => id,
      mep,
    });
    const de = (clave: string) => r.partidas.find((p) => p.clave === clave)!;
    expect(de("r-cuotas")).toMatchObject({ grupo: "cuotas", usd: { "2025-05": 200 } });
    expect(de("r-ref-negro")).toMatchObject({ grupo: "refuerzos", ars: { "2025-05": 5_000_000 } });
    expect(de("r-hormigon")).toMatchObject({ grupo: "obra", usd: { "2025-05": 100 } });
    expect(de("r-honorarios").grupo).toBe("honorarios");
    expect(de("r-prestamos").grupo).toBe("prestamos");
    expect(de("r-anticipos").grupo).toBe("anticipos");
    expect(de("r-cuotas").movimientos![0].texto).toContain("Persona Inventada · 3B");
  });

  it("real + proyectado: corta en el mes de hoy", () => {
    const proy = leerCashFlowMadre(grilla).partidas;
    const real = [{ clave: "r", nombre: "Cuotas", grupo: "cuotas", tipo: "ingreso" as const, usd: { "2025-05": 7, "2025-06": 8 }, ars: {} }];
    const a = actualizado(proy, real, "2025-06");
    const t = totales(a, rangoDeMeses(["2025-04", "2025-09"]), "USD");
    expect(t.ingresos["2025-05"]).toBe(7);
    expect(t.ingresos["2025-06"]).toBe(100);
    expect(rangoDeMeses(["2025-11", "2026-02"])).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
