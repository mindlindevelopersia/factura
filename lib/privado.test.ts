import { describe, expect, it } from "vitest";
import { tramosSensibles } from "./privado";

const ocultos = (t: string) => tramosSensibles(t).map(([a, b]) => t.slice(a, b));

describe("modo privado: qué se oculta", () => {
  it("montos en dólares y en pesos", () => {
    expect(ocultos("Saldo US$ 113.286 y $ 1.234,56")).toEqual(["US$ 113.286", "$ 1.234,56"]);
    expect(ocultos("Total: USD 15.000 · $ 1,2 M")).toEqual(["USD 15.000", "$ 1,2 M"]);
  });
  it("superficies, porcentajes y números con miles o decimales", () => {
    expect(ocultos("1.538 m² vendibles (85,5%) a 1.721,73")).toEqual(["1.538 m²", "85,5%", "1.721,73"]);
    expect(ocultos("UVA 1721,73")).toEqual(["1721,73"]);
  });
  it("mails y teléfonos, pero no las menciones", () => {
    expect(ocultos("Escribile a persona@ejemplo.com o al +54 9 11 5555-0000, @Mati")).toEqual(["persona@ejemplo.com", "+54 9 11 5555-0000"]);
  });
  it("teléfonos con espacios, no las fechas ISO", () => {
    expect(ocultos("11 5555 0001 · 11 5555-0001 · 2026-11-02")).toEqual(["11 5555 0001", "11 5555-0001"]);
  });
  it("deja ver fechas, años, horas, contadores y unidades", () => {
    expect(ocultos("30/10/26 09:00 · 2026 · Abiertas (2) · UF 2C · 3 comentarios · Piso 9")).toEqual([]);
  });
});
