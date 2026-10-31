import { describe, expect, it } from "vitest";
import type { Celda } from "../finanzas/ingresos";
import { analizar, analizarTodos } from "./materiales";
import {
  base100,
  combinar,
  dolarDeArgentinaDatos,
  enDolares,
  leerDolarMensual,
  leerIpc,
  leerPreciosMedios,
  ranking,
  real,
  serieDeDatosGob,
  variacion,
  type Punto,
  type SerieMensual,
} from "./series";

const c = (valor: Celda["valor"]): Celda => ({ valor, color: null });
const serie = (id: string, puntos: Punto[]): SerieMensual => ({ id, nombre: id, grupo: "", unidad: "", fuente: "", puntos });
const meses = (desde: string, valores: number[]): Punto[] =>
  valores.map((valor, i) => {
    const [a, m] = desde.split("-").map(Number);
    const t = a * 12 + m - 1 + i;
    return { mes: `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`, valor };
  });

describe("lectores de la planilla", () => {
  it("IPC: los títulos de mes vienen como fechas raras; se cuenta desde el primero", () => {
    // 46007 = 16/12/2025 (así quedó "dic-16"); los siguientes no importan.
    const filas = [[c("Total nacional"), c(46007), c(45674), c("sept-17")], [], [c("Nivel general"), c(100), c(101.6), c("103,7")]];
    expect(leerIpc(filas)).toEqual([
      { mes: "2016-12", valor: 100 },
      { mes: "2017-01", valor: 101.6 },
      { mes: "2017-02", valor: 103.7 },
    ]);
  });

  it("dólar mensual: fechas, textos aaaa-mm-dd y mm/aa", () => {
    const filas = [
      [c("Diario"), c(null), c(null), c(null), c("Mensual")],
      [c("category"), c("valor"), c(null), c(null), c("category"), c("valor")],
      [c("x"), c(1), c(null), c(null), c("2015-01-30"), c(13.6)],
      [c("x"), c(1), c(null), c(null), c(42063), c("13,03")],
      [c("x"), c(1), c(null), c(null), c("10/25"), c(1475.11)],
    ];
    expect(leerDolarMensual(filas)).toEqual([
      { mes: "2015-01", valor: 13.6 },
      { mes: "2015-02", valor: 13.03 },
      { mes: "2025-10", valor: 1475.11 },
    ]);
  });

  it("precios medios: un insumo por fila, meses en la fila 1", () => {
    const filas = [
      [c("ID_Insumo"), c("Descripción"), c("Un"), c("ene.-15"), c("feb.-15"), c(null), c("mar.-15")],
      [c(4001), c("Acero  12 mm"), c("ton"), c(100), c(110), c(null), c(120)],
      [c(null), c(null), c(null)],
    ];
    expect(leerPreciosMedios(filas)).toEqual([
      {
        id: "4001",
        descripcion: "Acero 12 mm",
        unidad: "ton",
        puntos: [
          { mes: "2015-01", valor: 100 },
          { mes: "2015-02", valor: 110 },
          { mes: "2015-03", valor: 120 },
        ],
      },
    ]);
  });
});

describe("fuentes en línea", () => {
  it("ArgentinaDatos: el último valor de venta de cada mes", () => {
    const r = dolarDeArgentinaDatos([
      { fecha: "2026-09-01", venta: 1400 },
      { fecha: "2026-09-30", venta: 1450 },
      { fecha: "2026-10-15", venta: 1500 },
      { fecha: "mal", compra: 1 },
    ]);
    expect(r).toEqual([
      { mes: "2026-09", valor: 1450 },
      { mes: "2026-10", valor: 1500 },
    ]);
    expect(dolarDeArgentinaDatos({ error: "x" })).toEqual([]);
  });

  it("datos.gob.ar: { data: [[fecha, valor]] }", () => {
    expect(serieDeDatosGob({ data: [["2016-12-01", 100], ["2017-01-01", 101.6], ["x", null]] })).toEqual([
      { mes: "2016-12", valor: 100 },
      { mes: "2017-01", valor: 101.6 },
    ]);
  });

  it("combinar: la fuente en línea manda; la planilla completa lo que falta", () => {
    expect(combinar(meses("2025-02", [2, 3]), meses("2025-01", [10, 20, 30]))).toEqual(meses("2025-01", [10, 2, 3]));
    expect(combinar([], meses("2025-01", [1]))).toEqual(meses("2025-01", [1]));
  });
});

describe("comparaciones", () => {
  const cac = serie("cac", meses("2025-01", [100, 110, 120, 130]));
  const ipc = serie("ipc", meses("2025-01", [100, 105, 110, 115]));
  const corta = serie("corta", meses("2025-01", [100, 150]));

  it("variación y ranking, con aviso si la serie no llega al final", () => {
    const r = ranking([cac, ipc, corta], "2025-01", "2025-04");
    expect(r.map((v) => [v.serie.id, Math.round(v.variacion * 100), v.incompleta])).toEqual([
      ["corta", 50, true],
      ["cac", 30, false],
      ["ipc", 15, false],
    ]);
    expect(variacion(cac, "2024-01", "2025-04")).toBe(null);
  });

  it("real: cuánto le ganó una serie a la otra", () => {
    expect(real(variacion(cac, "2025-01", "2025-04")!, variacion(ipc, "2025-01", "2025-04")!)).toBeCloseTo(1.3 / 1.15 - 1);
  });

  it("base 100 y en dólares", () => {
    expect(base100([cac], "2025-02", "2025-04").valores.cac.map((v) => Math.round(v!))).toEqual([100, 109, 118]);
    expect(enDolares(cac, serie("blue", meses("2025-01", [10, 11]))).puntos).toEqual(meses("2025-01", [10, 10]));
  });
});

describe("alarma de materiales", () => {
  // 7 años de CAC que sube 2% por mes y un dólar quieto: en dólares, el material sube todos los meses.
  const n = 84;
  const cac = serie("cac", meses("2019-01", Array.from({ length: n }, (_, i) => 100 * 1.02 ** i)));
  const blue = serie("blue", meses("2019-01", Array.from({ length: n }, () => 50)));
  const insumo = (id: string, ultimo: number) => ({
    id,
    descripcion: id,
    unidad: "m3",
    // Sube como el CAC, salvo el último mes.
    puntos: meses("2019-01", Array.from({ length: n }, (_, i) => (i === n - 1 ? ultimo : 1000 * 1.02 ** i))),
  });

  it("barato contra el CAC y caro en dólares: depende de con qué plata se compre", () => {
    const precioNormal = 1000 * 1.02 ** (n - 1);
    const a = analizar(insumo("x", precioNormal * 0.8), cac, blue)!;
    expect(a.senalPesos).toBe("comprar");
    // En dólares el precio venía subiendo: aun con la baja, hoy está alto.
    expect(a.senalDolares).toBe("esperar");
    expect(a.resumen).toBe("depende");
    expect(a.motivo).toMatch(/con pesos que vienen de cuotas ajustadas por CAC, está barato; si se compra con dólares, está caro/);
  });

  it("si las dos lecturas dicen lo mismo, esa es la señal", () => {
    const a = analizar(insumo("x", 1000 * 1.02 ** (n - 1) * 3), cac, blue)!;
    expect(a).toMatchObject({ senalPesos: "esperar", senalDolares: "esperar", resumen: "esperar" });
  });

  it("sin dólar, usa solo la lectura con CAC; destacados primero", () => {
    const sin = analizar(insumo("x", 1000 * 1.02 ** (n - 1) * 0.5), cac, null)!;
    expect(sin).toMatchObject({ senalDolares: null, resumen: "comprar" });
    expect(analizarTodos([insumo("10", 1), insumo("4001", 1), insumo("142001", 1)], cac, blue).map((a) => a.id)).toEqual(["142001", "4001", "10"]);
  });
});

describe("comparar", () => {
  it("si una serie termina antes, las dos se miden hasta ese mes", async () => {
    const { comparar } = await import("./series");
    const cac = serie("cac", meses("2025-01", [100, 110, 120, 130]));
    const ipc = serie("ipc", meses("2025-01", [100, 105]));
    const r = comparar(cac, ipc, "2025-01", "2025-04")!;
    expect(r).toMatchObject({ hasta: "2025-02", recortado: true });
    expect(r.a.variacion).toBeCloseTo(0.1);
    expect(r.b.variacion).toBeCloseTo(0.05);
  });
});
