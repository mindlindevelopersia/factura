import { describe, expect, it } from "vitest";
import { avisoDeFila, filaDeAviso, RegistroAvisos, ultimoPorCuenta, validarAviso, type AvisoCobranza } from "./avisos";
import type { PestaniaSimple } from "../google/pestania";

const aviso = (cuenta: string, fecha: string, estado = "Avisado"): AvisoCobranza => ({
  fecha,
  usuario: "tadeo@mindlin.com",
  cuenta,
  inversor: "Ana",
  unidad: "2A",
  canal: "WhatsApp",
  estado,
  monto: "$ 1.000",
  nota: "",
});

describe("registro de avisos", () => {
  it("ida y vuelta a la fila de la planilla", () => {
    const a = aviso("2a-ana", "2026-10-31T12:00:00.000Z");
    expect(avisoDeFila(filaDeAviso(a))).toEqual(a);
    expect(avisoDeFila(["2026-10-31"])).toMatchObject({ fecha: "2026-10-31", nota: "" });
  });

  it("valida estado, canal y largo de la nota", () => {
    expect(validarAviso(aviso("x", "f"))).toBe(null);
    expect(validarAviso({ ...aviso("x", "f"), estado: "Cualquiera" })).toMatch(/Estado/);
    expect(validarAviso({ ...aviso("x", "f"), canal: "Paloma" })).toMatch(/Canal/);
    expect(validarAviso({ ...aviso("x", "f"), nota: "a".repeat(501) })).toMatch(/larga/);
    expect(validarAviso({ estado: "Avisado", canal: "Mail" })).toMatch(/cuenta/);
  });

  it("el último aviso de cada cuenta", () => {
    const u = ultimoPorCuenta([aviso("a", "2026-10-01"), aviso("a", "2026-10-20", "Prometió pagar"), aviso("b", "2026-09-01")]);
    expect(u.get("a")?.estado).toBe("Prometió pagar");
    expect(u.get("b")?.fecha).toBe("2026-09-01");
  });

  it("lista del más nuevo al más viejo y agrega al final de la pestaña", async () => {
    const filas: string[][] = [filaDeAviso(aviso("a", "2026-10-01")), [], filaDeAviso(aviso("b", "2026-10-15"))];
    const pestania = { filas: async () => filas, agregar: async (f: string[]) => (filas.push(f), filas.length + 1) } as unknown as PestaniaSimple;
    const r = new RegistroAvisos(pestania);
    expect((await r.listar()).map((a) => a.cuenta)).toEqual(["b", "a"]);
    await r.agregar(aviso("c", "2026-10-31"));
    expect(filas.at(-1)?.[2]).toBe("c");
  });
});
