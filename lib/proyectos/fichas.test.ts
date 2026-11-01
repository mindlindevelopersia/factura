import { describe, expect, it } from "vitest";
import type { Celda } from "../finanzas/ingresos";
import { leerFichasVentas, mesDeBaseCac } from "./fichas";

const f = (...v: Celda["valor"][]): Celda[] => v.map((valor) => ({ valor, color: null }));

// La forma de las fichas debajo de la tabla de Ventas (una vieja sin pesos, una nueva con pesos).
const FILAS: Celda[][] = [
  f(null, "Nombre", "Tipo", "Unidad", "Costo estimado"),
  f(null, "Valen Italiano", "Costo", "2D", 74701),
  f("----------------------"),
  f("Vicente Atela"),
  f("- Base CAC FEBRERO 2025"),
  f("Unidad funcional"),
  f("3A"),
  f("Valor estimado", 101805.13, 1),
  f("Aporte blanco", 66173.33, 0.65),
  f("Aporte en negro", 35631.8, 0.35),
  f("----------------------"),
  f("Valentin Italiano & Belen"),
  f("-Base cac MAYO 2025"),
  f("Unidad funcional"),
  f(null),
  f("2D"),
  f("Concepto", "USD", "ARS", "Porcentaje"),
  f("Valor estimado", 74701, 89641200, 1),
  f("Aporte blanco", 51701, 62041200, 0.69),
  f("Aporte en negro", 23000, 27600000, 0.31),
  f("----------------------"),
  f("CAIDOS:"),
  f("Alguien"),
  f("Valor estimado", 91500, 1),
];

describe("fichas de Ventas", () => {
  it("lee nombre, mes base, unidad, costo en dólares y pesos, formal e informal; corta en CAIDOS", () => {
    expect(leerFichasVentas(FILAS)).toEqual([
      { nombre: "Vicente Atela", unidad: "3A", mesBase: "2025-02", costoUsd: 101805.13, costoArs: null, formalUsd: 66173.33, informalUsd: 35631.8, fila: 8 },
      { nombre: "Valentin Italiano & Belen", unidad: "2D", mesBase: "2025-05", costoUsd: 74701, costoArs: 89641200, formalUsd: 51701, informalUsd: 23000, fila: 18 },
    ]);
  });

  it("entiende el mes base escrito de varias formas", () => {
    expect(mesDeBaseCac("-Base cac Marzo 2026")).toBe("2026-03");
    expect(mesDeBaseCac("- Base CAC ENERO 2025")).toBe("2025-01");
    expect(mesDeBaseCac("Base")).toBe(null);
  });
});
