import { describe, expect, it } from "vitest";
import type { Celda, FlujoIngresos, Pago } from "../finanzas/ingresos";
import { conAcumulado, leerBloques, parecido, resumenCuenta, slug, totalesCuentas, unirConFlujo } from "./cuentas";

// Una grilla inventada con la forma de "Pagos por Inversor": bloques de 10 columnas, uno al lado del otro.
const ANCHO = 50;
const grilla = (): Celda[][] => Array.from({ length: 40 }, () => Array.from({ length: ANCHO }, () => ({ valor: null, color: null })));
const poner = (g: Celda[][], fila: number, col: number, ...valores: (string | number | null)[]) => valores.forEach((v, i) => (g[fila - 1][col + i] = { valor: v, color: null }));
// 46082 = 1/3/2026 en número de serie de Sheets.
const MARZO = 46082;

function bloque(g: Celda[][], col: number, ficha: [string, string, string], precio: [number, number, number], pagos: (string | number | null)[][], extra?: { plantilla?: boolean }) {
  poner(g, 2, col, "Estado de cuenta al: 12/02/2026");
  poner(g, 4, col + 2, "Inversor", "Emprendimiento", "Departamento", "Cuit", "Número Teléfono", "Mes Base CAC");
  poner(g, 5, col + 2, ficha[0], "MIND Lerma 439", ficha[1], ficha[2], "54 9 11 0000-0000", MARZO);
  poner(g, 9, col + 3, "Costo Estimado Departamento", precio[0], precio[0] * 1000);
  poner(g, 10, col + 3, "Monto Total Formal", precio[1], precio[1] * 1000);
  poner(g, 11, col + 3, "Monto Total Informal", precio[2], precio[2] * 1000);
  poner(g, 22, col, "Operación", "Monto", "Moneda", "Legalidad", "Monto en Pesos", "Tipo de Cambio", "Monto en Dólares", "Número de Concepto", "Concepto");
  if (extra?.plantilla) poner(g, 22, col + 10, "Operación", "Monto", "Moneda", "Legalidad", "Monto en Pesos", "Número de Concepto", "Concepto");
  pagos.forEach((p, i) => poner(g, 23 + i, col, ...p));
  const fin = 23 + pagos.length + 2;
  poner(g, fin, col, "NOTAS");
  poner(g, fin + 1, col, "1) LERMA es un desarrollo al costo.");
  poner(g, fin + 3, col, "Comentarios: ");
  poner(g, fin + 4, col, "Pagó dos cuotas juntas.");
}

const G = grilla();
bloque(G, 1, ["Nicolás Retirado", "NINGUNO", "#REF!"], [100, 60, 40], [[MARZO, 10, "Dólares", "Formal", 10000, 1000, 10, "-", "Aporte"]]);
bloque(
  G,
  11,
  ["Ana Pérez", "2A", "27-11111111-1"],
  [1000, 600, 400],
  [
    [MARZO, 300, "Dólares", "Formal", 300000, 1000, 300, "-", "Aporte Inicial"],
    [MARZO + 31, 200, "Dólares", "Informal", 200000, 1000, 200, "-", "Aporte Inicial"],
    [MARZO + 40, 100000, "Pesos", "Formal", 100000, 1250, 80, 1, "Cuota Mensual"],
    ["-", "-", "-", "-", "-", "-", "-", "-", "-"],
    ["31/06/2026", 50000, "Pesos", "Formal", 50000, 1250, 40, 2, "Cuota Mensual"],
    ["09/12/2026", 1000, "Dólares", "Formal", 1000000, 1000, 1000, "-", "Fecha futura"],
  ],
  { plantilla: true },
);
bloque(G, 31, ["Beto Druck", "4D", "20-2"], [300, 200, 100], [[MARZO, 100, "Dólares", "Negro", 100000, 1000, 100, "-", "Aporte"]]);
bloque(G, 41, ["Iony Druck", "4D", "20-3"], [300, 200, 100], []);

const flujoPago = (inversor: string, unidad: string, mes: string, monto: number, estado: Pago["estado"], bn: Pago["bn"] = "blanco"): Pago => ({
  inversor,
  unidad,
  tipo: "cuota",
  detalle: "Cuota mensual",
  bn,
  moneda: "ARS",
  mes,
  monto,
  estado,
  atrasado: estado === "a-cobrar" && mes < "2026-10",
  celda: `X${inversor.length}${mes}`,
});
const FLUJO: FlujoIngresos = {
  mesActual: "2026-10",
  avisos: [],
  pagos: [
    flujoPago("Ana Perez SA", "2A", "2026-09", 1000, "a-cobrar"),
    flujoPago("Ana Perez SA", "2A", "2026-11", 1100, "a-cobrar"),
    flujoPago("Ana Perez SA", "2A", "2026-12", 1200, "a-cobrar", "negro"),
    flujoPago("Ioni Druck", "4D", "2026-11", 500, "a-cobrar"),
    flujoPago("Ana Pérez", "2B", "2027-01", 700, "a-cobrar"),
    flujoPago("Valentina Sola", "2D", "2026-10", 900, "a-cobrar"),
    flujoPago("Beto Druck", "4D", "2026-08", 50, "cobrado"),
  ],
};

const bloques = leerBloques(G, "2026-10");
const cc = unirConFlujo(bloques, FLUJO);
const ana = cc.cuentas.find((c) => c.inversor === "Ana Pérez")!;

describe("leerBloques", () => {
  it("marca los bloques con unidad inválida y no los cuenta si sus pagos no son de nadie del Flujo", () => {
    expect(bloques.filter((b) => !b.sinUnidad).map((b) => b.inversor)).toEqual(["Ana Pérez", "Beto Druck", "Iony Druck"]);
    expect(bloques.some((b) => b.sinUnidad)).toBe(true);
    expect(cc.cuentas.some((c) => c.sinUnidad)).toBe(false);
  });

  it("une un bloque con el encabezado roto a quien tiene esos pagos en el Flujo", () => {
    const original = bloques.find((b) => b.inversor === "Ana Pérez")!;
    const roto = { ...original, inversor: "Otro Nombre", unidad: "#REF!", sinUnidad: true, columna: "AP" };
    const cobros = original.pagos.slice(0, 3).map((p, i) => ({ ...flujoPago("Valen Nuevo", "9Z", `2026-0${i + 1}`, p.monto, "cobrado"), moneda: p.moneda }));
    expect(cobros.length).toBe(3);
    const u = unirConFlujo([roto], { ...FLUJO, pagos: [...cobros, flujoPago("Valen Nuevo", "9Z", "2026-11", 10, "a-cobrar")] });
    const valen = u.cuentas.find((c) => c.inversor === "Valen Nuevo")!;
    expect(valen).toMatchObject({ unidad: "9Z", origen: "planilla", columna: "AP", precioUsd: null });
    expect(valen.pagos.length).toBe(original.pagos.length);
    expect(valen.avisos.map((a) => a.tipo)).toContain("encabezado");
    expect(u.cuentas.some((c) => c.inversor === "Otro Nombre")).toBe(false);
    // Sin precio: lo pagado no baja el saldo total.
    const t = totalesCuentas(u.cuentas, "2026-10");
    expect(t).toMatchObject({ precio: 0, saldo: 0, sinPrecio: ["9Z"] });
  });

  it("lee la ficha, el precio, los montos formal e informal, notas y comentarios", () => {
    expect(ana).toMatchObject({
      id: "2a-ana-perez",
      unidad: "2A",
      cuit: "27-11111111-1",
      mesBaseCac: "2026-03",
      precioUsd: 1000,
      formalUsd: 600,
      informalUsd: 400,
      columna: "L",
      notas: ["1) LERMA es un desarrollo al costo."],
      comentarios: ["Pagó dos cuotas juntas."],
    });
  });

  it("lee los pagos aunque al lado haya una plantilla vacía, y saltea los de relleno", () => {
    expect(ana.pagos.map((p) => [p.monto, p.moneda, p.formal, p.usd])).toEqual([
      [300, "USD", true, 300],
      [200, "USD", false, 200],
      [100000, "ARS", true, 80],
      [50000, "ARS", true, 40],
      [1000, "USD", true, 1000],
    ]);
  });

  it("marca las fechas imposibles o futuras", () => {
    expect(ana.pagos.filter((p) => !p.fecha).map((p) => p.fechaTexto)).toEqual(["31/06/2026", "09/12/2026"]);
    expect(ana.avisos.find((a) => a.tipo === "fecha")?.filas).toEqual([27, 28]);
  });

  it("toma 'Negro' como informal", () => {
    expect(cc.cuentas.find((c) => c.inversor === "Beto Druck")!.pagos[0].formal).toBe(false);
  });
});

describe("unirConFlujo", () => {
  it("une por unidad y nombre parecido, también con una letra distinta", () => {
    expect(ana.pendientes.map((p) => p.mes)).toEqual(["2026-09", "2026-11", "2026-12", "2027-01"]);
    expect(cc.cuentas.find((c) => c.inversor === "Iony Druck")!.pendientes).toHaveLength(1);
    expect(cc.cuentas.find((c) => c.inversor === "Beto Druck")!.cobradoFlujo).toHaveLength(1);
  });

  it("una unidad compartida son cuentas separadas", () => {
    expect(cc.cuentas.filter((c) => c.unidad === "4D").map((c) => c.inversor)).toEqual(["Beto Druck", "Iony Druck"]);
  });

  it("lo del Flujo sin bloque arma una cuenta aparte, con aviso", () => {
    const sola = cc.cuentas.find((c) => c.inversor === "Valentina Sola")!;
    expect(sola).toMatchObject({ origen: "flujo", unidad: "2D", precioUsd: null });
    expect(sola.avisos[0].tipo).toBe("solo-flujo");
  });
});

describe("resumen", () => {
  it("avance en dólares, formal e informal, saldo, vencidos y próximo pago", () => {
    const r = resumenCuenta(ana, "2026-10");
    expect(r).toMatchObject({ baseUsd: 1000, pagadoUsd: 1620, saldoUsd: -620 });
    expect(r.avance).toBeCloseTo(1.62);
    expect(r.formal).toMatchObject({ objetivo: 600, pagado: 1420 });
    expect(r.informal).toMatchObject({ objetivo: 400, pagado: 200 });
    expect(r.vencidos.map((p) => p.mes)).toEqual(["2026-09"]);
    expect(r.proximo).toEqual({ mes: "2026-11", montos: [{ moneda: "ARS", monto: 1100 }] });
    expect(r.ultimoMes).toBe("2027-01");
    expect(r.ultimoPago?.concepto).toBe("Cuota Mensual");
  });

  it("sin lo informal: base formal, solo pagos y pendientes formales", () => {
    const r = resumenCuenta(ana, "2026-10", false);
    expect(r).toMatchObject({ baseUsd: 600, pagadoUsd: 1420, saldoUsd: -820 });
    expect(r.pendienteFlujo.ARS).toBe(1000 + 1100 + 700);
  });

  it("acumulado pago a pago", () => {
    expect(conAcumulado(ana.pagos, 1000).map((p) => p.acumuladoUsd)).toEqual([300, 500, 580, 620, 1620]);
  });

  it("totales de todas las cuentas", () => {
    const t = totalesCuentas(cc.cuentas, "2026-10");
    expect(t).toMatchObject({ cuentas: 4, precio: 1600, pagado: 1720, saldo: -120, conVencidos: 1 });
  });

  it("avisa si pagó más del 100%", () => {
    expect(ana.avisos.some((a) => a.tipo === "mas-del-100")).toBe(true);
  });
});

describe("auxiliares", () => {
  it("parecido entre nombres", () => {
    expect(parecido("Iony Druck", "Ioni Druck")).toBe(2);
    expect(parecido("Octavio Sangiacomo / Jorgelina", "Jorgelina Fulvia")).toBe(1);
    expect(parecido("Emporio", "Jorge Bisignano")).toBe(0);
  });

  it("slug para la URL", () => {
    expect(slug("4D", "Alón Druck")).toBe("4d-alon-druck");
  });
});
