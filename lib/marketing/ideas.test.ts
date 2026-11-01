import { describe, expect, it } from "vitest";
import { AREAS_EMPRESA } from "../modulos";
import { IDEAS } from "./ideas";

describe("marketing: las tarjetas de idea", () => {
  const area = AREAS_EMPRESA.find((a) => a.href === "/marketing")!;
  it("cada submódulo del menú tiene su tarjeta y viceversa", () => {
    expect(area.modulos.map((m) => m.href).sort()).toEqual(IDEAS.map((i) => `/marketing/${i.sub}`).sort());
  });
  it("cada tarjeta tiene etapas, integraciones, decisiones y primer paso", () => {
    for (const i of IDEAS) {
      expect(i.etapas.length).toBeGreaterThan(0);
      expect(i.integraciones.length).toBeGreaterThan(0);
      expect(i.decisiones.length).toBeGreaterThan(0);
      expect(i.primerPaso.length).toBeGreaterThan(10);
    }
  });
});
