import { describe, expect, it } from "vitest";
import { camino } from "./Migas";

describe("migas", () => {
  it("arma el camino con los nombres del hub", () => {
    expect(camino("/proyectos/lerma-439/comercial/unidades").map((m) => m.nombre)).toEqual(["HQ", "Lerma 439", "Comercial", "Unidades"]);
    expect(camino("/indicadores/cac").map((m) => m.nombre)).toEqual(["HQ", "Indicadores", "Índice CAC"]);
    expect(camino("/proyectos/lerma-439/inversores/cuentas-corrientes/5b-pablo-pallini").map((m) => m.nombre)).toEqual(["HQ", "Lerma 439", "Inversores", "Cuentas corrientes", "Detalle"]);
  });
});
