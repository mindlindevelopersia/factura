import { describe, expect, it } from "vitest";
import { calcularPropuesta, nombreDelPdf, parametrosIniciales, propuestaAUrl, propuestaDeUrl, type ParametrosPropuesta } from "./propuesta";

// La propuesta de Virginia (2C): US$ 113.286 a $ 1.570, 70/30, anticipos 1.000 y 10.000,
// 17 cuotas (nov 26 a abr 28), dos refuerzos de A del 20% y uno de B.
const VIRGINIA: ParametrosPropuesta = {
  cliente: "Virginia Alegre",
  unidad: "2C",
  precioUsd: 113286,
  tipoCambio: 1570,
  mesBaseCac: "2026-09",
  formal: 0.7,
  anticipoAUsd: 1000,
  anticipoBUsd: 10000,
  cuotas: { cantidad: 17, desde: "2026-11" },
  refuerzosA: [
    { mes: "2026-12", porcentaje: 0.2 },
    { mes: "2027-12", porcentaje: 0.2 },
  ],
  refuerzosB: ["2026-12"],
  fecha: "2026-10-01",
  vigenciaDias: 7,
  mostrarB: true,
};

describe("propuesta comercial", () => {
  it("da los mismos números que la ficha de Virginia en Ventas", () => {
    const r = calcularPropuesta(VIRGINIA);
    expect(r.totalArs).toBe(177859020);
    expect(r.A.usd).toBeCloseTo(79300.2);
    expect(r.A.ars).toBeCloseTo(124501314);
    expect(r.A.saldoArs).toBeCloseTo(122931314);
    expect(r.A.refuerzos.map((x) => x.ars)).toEqual([35571804, 35571804]);
    expect(r.A.cuotaArs).toBeCloseTo(3046335.65, 1);
    expect(r.B.ars).toBeCloseTo(53357706);
    expect(r.B.saldoArs).toBeCloseTo(37657706);
    expect(r.B.refuerzos).toEqual([{ mes: "2026-12", ars: 37657706 }]);
    expect(r.cronograma.filter((p) => p.concepto.startsWith("Cuota")).length).toBe(17);
    expect(r.cronograma.at(-1)?.mes).toBe("2028-03");
    expect(r.problemas).toEqual([]);
    expect(r.hasta).toBe("2026-10-08");
  });

  it("avisa lo que no cierra", () => {
    expect(calcularPropuesta({ ...VIRGINIA, refuerzosA: [{ mes: "2026-12", porcentaje: 0.8 }] }).problemas[0]).toMatch(/refuerzos de A suman más/);
    expect(calcularPropuesta({ ...VIRGINIA, refuerzosB: [] }).problemas).toContain("Falta el refuerzo de B para pagar su saldo.");
  });

  it("arranca con los valores de Virginia y va y vuelve por la URL", () => {
    const p = parametrosIniciales({ cliente: "Laura", unidad: "1C", precioUsd: 111612.4, tipoCambio: 1557.2, hoy: "2026-11-01", entrega: "2028-04" });
    expect(p).toMatchObject({ precioUsd: 111612, tipoCambio: 1557, mesBaseCac: "2026-10", cuotas: { cantidad: 17, desde: "2026-12" }, refuerzosB: ["2026-12"] });
    expect(propuestaDeUrl(new URLSearchParams(propuestaAUrl(VIRGINIA)), p)).toEqual(VIRGINIA);
  });
});

import { planoDe } from "./planos";
describe("planos", () => {
  it("por tipología y orientación; PB la suya; pisos 8 y 9 sin plano", () => {
    expect(planoDe("lerma-439", { nivel: 2, tipologia: "2 ambientes", orientacion: "Contrafrente" })).toBe("/api/proyectos/lerma-439/imagenes/plano-2amb-contrafrente.png");
    expect(planoDe("lerma-439", { nivel: 4, tipologia: "3 ambientes", orientacion: "Frente" })).toBe("/api/proyectos/lerma-439/imagenes/plano-3amb-frente.png");
    expect(planoDe("lerma-439", { nivel: 0, tipologia: "3 ambientes + jardín", orientacion: "Contrafrente" })).toBe("/api/proyectos/lerma-439/imagenes/plano-pb.png");
    expect(planoDe("lerma-439", { nivel: 8, tipologia: "2 ambientes", orientacion: "Frente" })).toBe(null);
  });
});

describe("nombreDelPdf", () => {
  it("arma UF, proyecto y cliente", () => {
    expect(nombreDelPdf({ unidad: "2C", cliente: "Persona Inventada" }, "Lerma 439")).toBe("UF 2C - LERMA 439 - Persona Inventada by Mindlin Developers");
  });
  it("sin cliente y sin caracteres prohibidos", () => {
    expect(nombreDelPdf({ unidad: "2C", cliente: "" }, "Lerma 439")).toBe("UF 2C - LERMA 439 by Mindlin Developers");
    expect(nombreDelPdf({ unidad: "2C", cliente: "Ana / Juan: socios" }, "Lerma 439")).toBe("UF 2C - LERMA 439 - Ana Juan socios by Mindlin Developers");
  });
});
