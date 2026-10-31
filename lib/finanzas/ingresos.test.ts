import { describe, expect, it } from "vitest";
import {
  aCsv,
  colorDe,
  filtrar,
  filtrosAUrl,
  filtrosDeUrl,
  leerFlujo,
  mesDeEncabezado,
  mesDeFecha,
  porInversor,
  porMes,
  SIN_FILTROS,
  sumarMeses,
  totalesPorMoneda,
  type Celda,
  type Color,
} from "./ingresos";

// Datos inventados con la forma de "Flujo de fondos LERMA".
const ENCABEZADOS = ["Inversores", "Mes Base CAC", "Desarrollo", "Unidad Funcional ", "CUIT", "TIPO DE PAGO", "B o N?", "MONEDA?", "ANTICIPO USD", "CUOTA BASE", "REFUERZOS", "Totales", "Agosto 2026", "Septiembre 2026", "Octubre 2026", "Noviembre 2026", "Diciembre 2026"];
const c = (valor: Celda["valor"], color: Color = null): Celda => ({ valor, color });
const v = (n: number) => c(n, "verde");
const r = (n: number) => c(n, "rosa");
/** Fila con los datos fijos y los meses (agosto a diciembre de 2026). */
const fila = (inversor: string, tipo: string, bn: string, moneda: string, extra: { base?: number; anticipo?: number; uf?: string } = {}, meses: Celda[] = []): Celda[] => [
  c(inversor),
  c(extra.base ?? null),
  c("MIND Lerma 439"),
  c(extra.uf ?? "1A"),
  c(null),
  c(tipo),
  c(bn),
  c(moneda),
  c(extra.anticipo ?? null),
  c(null),
  c(null),
  c(null),
  ...meses,
];
// 46082 = 1/3/2026 en número de serie de Sheets.
const MARZO_2026 = 46082;

const FILAS: Celda[][] = [
  ENCABEZADOS.map((t) => c(t)),
  fila("Ana", "ANTICIPO", "Blanco", "USD", { base: MARZO_2026, anticipo: 1000, uf: "PB" }),
  fila("Ana", "ANTICIPO", "Negro", "USD", { base: MARZO_2026, anticipo: 9000, uf: "PB" }),
  fila("Ana", "CUOTA MENSUAL", "Blanco", "ARS", { uf: "PB" }, [v(100), v(110), r(120), r(130), r(140)]),
  fila("Ana", "REFUERZO 1", "Negro", "ARS", { uf: "PB" }, [c(null), c(null), c(null), r(5000)]),
  fila("Beto", "CUOTA MENSUAL", "Blanco", "ARS", { uf: "2B" }, [v(200), r(200), r(200), r(200), v(200)]),
  fila("Beto", "REFUERZO 2", "Blanco", "ARS", { uf: "2B" }, [c(50, "amarillo"), c(50, "amarillo")]),
  fila("Falta vender", "CUOTA MENSUAL", "Blanco", "ARS", { uf: "3C" }, [c(null), c(999, "celeste")]),
  fila("Falta vender", "CUOTA MENSUAL", "Blanco", "ARS", { uf: "3D" }),
  fila("Carla", "ANTICIPO", "Blanco", "USD", { anticipo: 500, uf: "4A" }),
  fila("Carla", "CUOTA MENSUAL", "Negro", "ARS", { uf: "4A" }, [c(10), c("pendiente", "rosa")]),
  fila("Dani", "CUOTA", "", "ARS", {}, [r(1)]),
  [c("Anticipos USD"), c(null), c("Lerma 439"), c(null), c(null), c(null), c("Negro"), c("USD"), c(9000)],
  [c("TOTALES (Cuotas + Refuerzos)"), ...Array(10).fill(c(null)), c(1000), c(1), c(2), c(3), c(4), c(5)],
];

const flujo = leerFlujo(FILAS, "2026-10");

describe("leerFlujo", () => {
  it("toma verde como cobrado y rosa como a cobrar, aunque el verde sea de un mes futuro", () => {
    const beto = flujo.pagos.filter((p) => p.inversor === "Beto" && p.tipo === "cuota");
    expect(beto.map((p) => [p.mes, p.estado])).toEqual([
      ["2026-08", "cobrado"],
      ["2026-09", "a-cobrar"],
      ["2026-10", "a-cobrar"],
      ["2026-11", "a-cobrar"],
      ["2026-12", "cobrado"],
    ]);
  });

  it("marca como vencido lo rosa de meses pasados y avisa una sola vez por fila", () => {
    const beto = flujo.pagos.filter((p) => p.inversor === "Beto" && p.tipo === "cuota");
    expect(beto.filter((p) => p.atrasado).map((p) => p.mes)).toEqual(["2026-09"]);
    const avisos = flujo.avisos.filter((a) => a.tipo === "atrasado" && a.inversor === "Beto");
    expect(avisos).toHaveLength(1);
    expect(avisos[0].detalle).toContain("Septiembre 2026");
    expect(avisos[0].detalle).toContain("CAC");
  });

  it("pone los anticipos como cobrados en el mes siguiente al mes base del CAC", () => {
    const anticipos = flujo.pagos.filter((p) => p.inversor === "Ana" && p.tipo === "anticipo");
    expect(anticipos.map((p) => [p.mes, p.monto, p.moneda, p.bn, p.estado])).toEqual([
      ["2026-04", 1000, "USD", "blanco", "cobrado"],
      ["2026-04", 9000, "USD", "negro", "cobrado"],
    ]);
  });

  it("un anticipo siempre es en dólares; si la fila dice otra moneda, avisa", () => {
    const f = leerFlujo([FILAS[0], fila("Eva", "ANTICIPO", "Negro", "ARS", { base: MARZO_2026, anticipo: 700 }), fila("Eva", "ANTICIPO", "Blanco", "", { base: MARZO_2026, anticipo: 300 })], "2026-10");
    expect(f.pagos.map((p) => [p.moneda, p.monto])).toEqual([
      ["USD", 700],
      ["USD", 300],
    ]);
    expect(f.avisos.filter((a) => a.tipo === "dato-raro")).toHaveLength(2);
  });

  it("un anticipo sin mes base cuenta como cobrado, sin mes, y va a revisar", () => {
    const carla = flujo.pagos.find((p) => p.inversor === "Carla" && p.tipo === "anticipo");
    expect(carla).toMatchObject({ mes: null, monto: 500, estado: "cobrado" });
    expect(flujo.avisos.some((a) => a.tipo === "sin-mes-base" && a.inversor === "Carla")).toBe(true);
  });

  it("lo amarillo se cuenta a cobrar y va a revisar", () => {
    const refuerzo = flujo.pagos.filter((p) => p.inversor === "Beto" && p.tipo === "refuerzo");
    expect(refuerzo.every((p) => p.estado === "a-cobrar")).toBe(true);
    expect(flujo.avisos.find((a) => a.tipo === "amarillo")).toMatchObject({ inversor: "Beto", unidad: "2B", monto: 100 });
  });

  it("no cuenta lo que falta vender: si tiene montos, avisa", () => {
    expect(flujo.pagos.some((p) => p.inversor === "Falta vender")).toBe(false);
    const avisos = flujo.avisos.filter((a) => a.tipo === "falta-vender");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ unidad: "3C", monto: 999 });
  });

  it("no cuenta un texto en una celda de mes, y lo avisa", () => {
    expect(flujo.pagos.filter((p) => p.inversor === "Carla" && p.tipo === "cuota").map((p) => p.monto)).toEqual([10]);
    expect(flujo.avisos.some((a) => a.tipo === "dato-raro" && a.inversor === "Carla")).toBe(true);
  });

  it("saltea una fila sin blanco/negro y la avisa", () => {
    expect(flujo.pagos.some((p) => p.inversor === "Dani")).toBe(false);
    expect(flujo.avisos.find((a) => a.tipo === "fila-incompleta")?.detalle).toContain("sin blanco/negro");
  });

  it("ignora las filas de totales, pero avisa si su total no da la suma de los meses", () => {
    expect(flujo.pagos.some((p) => p.inversor.startsWith("Anticipos") || p.inversor.startsWith("TOTALES"))).toBe(false);
    expect(flujo.avisos.find((a) => a.tipo === "total")).toMatchObject({ monto: 15 - 1000 });
  });

  it("dice qué columnas faltan", () => {
    expect(() => leerFlujo([[c("Inversores"), c("Marzo 2025")]], "2026-10")).toThrow(/TIPO DE PAGO/);
  });
});

describe("totales y agrupaciones", () => {
  it("separa las monedas y cuenta lo vencido dentro de lo a cobrar", () => {
    const t = totalesPorMoneda(flujo.pagos);
    expect(t.USD).toMatchObject({ cobrado: 10500, aCobrar: 0, total: 10500 });
    // Ana: 100+110 cobrado, 120+130+140 a cobrar, refuerzo 5000; Beto: 400 cobrado, 600 a cobrar + 100 amarillo; Carla: 10.
    expect(t.ARS.cobrado).toBe(610);
    expect(t.ARS.aCobrar).toBe(120 + 130 + 140 + 5000 + 600 + 100 + 10);
    // Vencidos (antes de octubre): Beto sep 200, Beto amarillo ago+sep 100, Carla ago 10.
    expect(t.ARS.atrasado).toBe(310);
  });

  it("arma los meses sin huecos, con blanco, negro y acumulado", () => {
    const meses = porMes(flujo.pagos, "ARS", "2026-10", "2026-12");
    expect(meses.map((m) => m.mes)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(meses[1]).toMatchObject({ blanco: 330, negro: 5000, total: 5330 });
    expect(meses.at(-1)!.acumulado).toBe(320 + 5330 + 340);
  });

  it("por inversor: próximo pago desde este mes y cantidad de vencidos", () => {
    const beto = porInversor(flujo.pagos, "2026-10").find((f) => f.inversor === "Beto")!;
    expect(beto.proximo).toEqual({ mes: "2026-10", monto: 200, moneda: "ARS" });
    expect(beto.atrasados).toBe(3);
    expect(beto.unidades).toEqual(["2B"]);
  });
});

describe("filtros", () => {
  it("filtra por rango, moneda, blanco/negro, tipo, estado e inversor", () => {
    const f = { ...SIN_FILTROS, desde: "2026-11", hasta: "2026-12", moneda: "ARS" as const, bn: "blanco" as const };
    expect(filtrar(flujo.pagos, f).map((p) => p.monto)).toEqual([130, 140, 200, 200]);
    expect(filtrar(flujo.pagos, { ...SIN_FILTROS, tipo: "anticipo", estado: "cobrado", inversor: "Ana" })).toHaveLength(2);
  });

  it("con rango de fechas, deja afuera lo que no tiene mes", () => {
    expect(filtrar(flujo.pagos, { ...SIN_FILTROS, desde: "2026-01" }).some((p) => p.mes === null)).toBe(false);
    expect(filtrar(flujo.pagos, SIN_FILTROS).some((p) => p.mes === null)).toBe(true);
  });

  it("van y vuelven de la URL, ignorando valores inválidos", () => {
    const f = { ...SIN_FILTROS, desde: "2026-11", moneda: "USD" as const, inversor: "Ana" };
    expect(filtrosDeUrl(new URLSearchParams(filtrosAUrl(f)))).toEqual(f);
    expect(filtrosDeUrl(new URLSearchParams("moneda=EUR&desde=noviembre&bn=gris"))).toEqual(SIN_FILTROS);
  });
});

describe("auxiliares", () => {
  it("reconoce los colores de la planilla", () => {
    expect(colorDe({ red: 0xb6 / 255, green: 0xd7 / 255, blue: 0xa8 / 255 })).toBe("verde");
    expect(colorDe({ red: 0xf4 / 255, green: 0xcc / 255, blue: 0xcc / 255 })).toBe("rosa");
    expect(colorDe({ red: 1, green: 1 })).toBe("amarillo");
    expect(colorDe({ red: 1, green: 1, blue: 1 })).toBe(null);
    expect(colorDe(undefined)).toBe(null);
    expect(colorDe({ red: 0.5 })).toBe("otro");
  });

  it("lee meses y fechas", () => {
    expect(mesDeEncabezado("Septiembre 2026")).toBe("2026-09");
    expect(mesDeEncabezado("Totales")).toBe(null);
    expect(mesDeFecha(MARZO_2026)).toBe("2026-03");
    expect(mesDeFecha("01/02/2025")).toBe("2025-02");
    expect(sumarMeses("2026-12", 1)).toBe("2027-01");
  });

  it("exporta CSV con punto y coma y coma decimal", () => {
    const csv = aCsv(flujo.pagos.slice(0, 1));
    expect(csv.startsWith("﻿Mes;Inversor")).toBe(true);
    expect(csv).toContain("2026-04;Ana;PB;Anticipo;Blanco;USD;1000,00;Cobrado;;I2");
  });
});
