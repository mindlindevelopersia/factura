import { describe, expect, it } from "vitest";
import type { Celda } from "../finanzas/ingresos";
import { actualizar, cacACsv, leerCac, mesDeCelda, rango } from "./cac";

// Datos inventados con la forma de "Índice CAC": tres filas por mes y la fecha en una de ellas.
const c = (valor: Celda["valor"]): Celda => ({ valor, color: null });
const fila = (fecha: Celda["valor"], denominacion: string, indice: Celda["valor"], variacion: Celda["valor"] = null) => [fecha, denominacion, indice, variacion].map(c);
// 46023 = 1/1/2026 en número de serie de Sheets.
const ENE = 46023;
const mes = (fecha: Celda["valor"], g: number, m: number, mo: number, variacion?: number): Celda[][] => [
  fila(null, "Costo de Construcción", g, variacion ?? null),
  fila(fecha, "Materiales", m),
  fila(null, "Mano de Obra", mo),
];

const FILAS: Celda[][] = [
  [c(3), c("ÍNDICE"), c("BASE 100 DIC 2014"), c("VARIACIÓN MES ANTERIOR")],
  ...mes("dic-25", 100, 100, 100),
  ...mes(ENE, 102, 101, 104, 0.02),
  ...mes(ENE + 31, 103.02, 102, 105, 0.05),
  ...mes(ENE + 59, 110, 108, 112),
  ...mes(ENE + 90, 115, 112, 118),
  // Mayo: mes sin publicar (copia del anterior en la general, vacío en las otras).
  [...fila(null, "Costo de Construcción", 115, 0)],
  [...fila(ENE + 120, "Materiales", null, -1)],
  [...fila(null, "Mano de Obra", "#DIV/0!", -1)],
];

const serie = leerCac(FILAS);

describe("leerCac", () => {
  it("lee los meses publicados, con fecha en texto o número, y descarta los que no salieron", () => {
    expect(serie.meses.map((m) => m.mes)).toEqual(["2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(serie.ultimo).toBe("2026-04");
    expect(serie.meses[1]).toMatchObject({ general: { indice: 102 }, materiales: { indice: 101 }, manoDeObra: { indice: 104 } });
  });

  it("calcula las variaciones mensual, acumulada anual e interanual desde los índices", () => {
    const feb = serie.meses[2];
    expect(feb.general.mensual).toBeCloseTo(0.01);
    expect(feb.general.anual).toBeCloseTo(0.0302);
    expect(feb.general.interanual).toBe(null);
    expect(serie.meses[0].general.mensual).toBe(null);
  });

  it("marca los últimos tres meses como provisorios", () => {
    expect(serie.meses.map((m) => m.provisorio)).toEqual([false, false, true, true, true]);
  });

  it("avisa si la variación escrita en la planilla no coincide con los índices", () => {
    expect(serie.avisos).toHaveLength(1);
    expect(serie.avisos[0].detalle).toContain("2026-02");
    expect(serie.avisos[0].filas).toEqual([8]);
  });

  it("avisa si falta un mes en el medio", () => {
    const sin = leerCac([...mes("dic-25", 100, 100, 100), ...mes(ENE + 31, 103, 102, 105)]);
    expect(sin.avisos[0].titulo).toMatch(/faltan/);
    expect(sin.meses[1].general.mensual).toBe(null);
  });
});

describe("actualizar", () => {
  it("monto × índice final ÷ índice inicial", () => {
    const r = actualizar(serie, 1000, "2026-01", "2026-03")!;
    expect(r.monto).toBeCloseTo((1000 * 110) / 102);
    expect(r).toMatchObject({ desde: "2026-01", hasta: "2026-03", usoUltimo: false });
    expect(actualizar(serie, 1000, "2026-01", "2026-03", "manoDeObra")!.monto).toBeCloseTo((1000 * 112) / 104);
  });

  it("si el mes final no salió, usa el último publicado y lo dice", () => {
    expect(actualizar(serie, 1000, "2025-12", "2026-08")).toMatchObject({ hasta: "2026-04", usoUltimo: true, monto: 1150 });
    expect(actualizar(serie, 1000, "2024-01", "2026-03")).toBe(null);
  });
});

describe("auxiliares", () => {
  it("lee los períodos", () => {
    expect(mesDeCelda("ene-15")).toBe("2015-01");
    expect(mesDeCelda("Sep 2026")).toBe("2026-09");
    expect(mesDeCelda(ENE)).toBe("2026-01");
  });

  it("rango y CSV", () => {
    expect(rango(serie, "2026-02", "2026-03").map((m) => m.mes)).toEqual(["2026-02", "2026-03"]);
    const csv = cacACsv(rango(serie, "2026-01", "2026-01"));
    expect(csv).toContain("2026-01;Costo de Construcción;102,0;2,00;2,00;;");
    expect(csv.split("\r\n")).toHaveLength(4);
  });
});
