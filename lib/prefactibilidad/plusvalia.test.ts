import { describe, expect, it } from "vitest";
import { calcular, datosVacios } from "./modelo";
import { calcularPlusvalia, limpiarPlusvalia, plusvaliaDeEERR, uvaDelDia } from "./plusvalia";

// Números inventados con la misma forma que la cuenta del Excel.
const datos = () => {
  const d = datosVacios("2026-11-02");
  d.terrenos = [{ nombre: "T", frente: 10, fondo: 20 }];
  d.normativa.fot = 2;
  d.pisos = [{ nombre: "PB", cubierta: 900, semicubierta: 100, descubiertas: [], computaGcba: true }];
  d.plusvalia = limpiarPlusvalia({ incidencia: 100, alicuota: 0.25, descuentoContado: 0.15 });
  return d;
};

describe("plusvalía", () => {
  it("la cuenta de la Ley 6062, con la superficie según GCBA si no se carga otra", () => {
    const d = datos();
    const r = calcularPlusvalia(d, calcular(d), { uva: { valor: 1000, fecha: "2026-11-02", fuente: "prueba" }, mep: 1250 });
    const v = (k: string) => r.pasos.find((p) => p.clave === k)!.valor;
    expect(v("superficie")).toBe(1000); // construible según GCBA
    expect(v("a1")).toBe(800);
    expect(v("a2")).toBe(400); // 200 × 2
    expect(v("a")).toBe(400);
    expect(v("b")).toBe(25);
    expect(v("base")).toBe(10000);
    expect(r.total).toBe(10_000_000);
    expect(r.conDescuento).toBe(8_500_000);
    expect(r.enDolares).toBe(6800);
    expect(r.pasos.find((p) => p.clave === "a1")!.cuenta).toBe("1.000 × 0,8 = 800");
  });

  it("superficie del Gobierno a mano, A negativo da 0 y avisa", () => {
    const d = datos();
    d.plusvalia.superficieComputable = 400;
    const r = calcularPlusvalia(d, calcular(d), { uva: { valor: 1000, fecha: "x", fuente: "" }, mep: null });
    expect(r.pasos.find((p) => p.clave === "a")!.valor).toBe(0);
    expect(r.avisos[0]).toContain("no corresponde plusvalía");
  });

  it("verifica contra lo pagado: el UVA que surge del pago contra el oficial", () => {
    const d = datos();
    d.plusvalia.pago = { fecha: "2026-01-15", monto: 8_500_000 };
    const r = calcularPlusvalia(d, calcular(d), { uva: null, mep: null, uvaDelPago: 990 });
    expect(r.verificacion).toMatchObject({ totalImplicito: 10_000_000, uvaImplicito: 1000, uvaOficial: 990 });
    expect(r.verificacion!.diferencia).toBeCloseTo(0.0101, 4);
  });

  it("el UVA del día (el último publicado hasta esa fecha)", () => {
    const serie = [{ fecha: "2026-01-14", valor: 1 }, { fecha: "2026-01-15", valor: 2 }, { fecha: "2026-01-17", valor: 3 }];
    expect(uvaDelDia(serie, "2026-01-16")).toEqual({ fecha: "2026-01-15", valor: 2 });
    expect(uvaDelDia(serie, "2025-01-01")).toBe(null);
  });

  it("lee la pestaña EE.RR (con su forma, números inventados)", () => {
    const c = (...v: (string | number | null)[]) => v.map((valor) => ({ valor }));
    const r = plusvaliaDeEERR([
      c(null, "Superficie Banda Edificable", null, 0, 1000, 1000),
      c(null, "Superficie de parcela ", null, null, 150),
      c(null, "Ajuste", null, null, null, 0.8),
      c("A", "FOT", null, null, null, 2),
      c(null, "Valor de Incidencia del Suelo (Ley 6062)", null, null, null, 100),
      c(null, "Alícuota = S/Polígonos Establecidos en la Ley 6062", null, null, "Zona 2", 0.2, "https://link"),
    ]);
    expect(r).toEqual({ superficieComputable: 1000, superficieParcela: 150, ajuste: 0.8, fot: 2, incidencia: 100, alicuota: 0.2, zona: "Zona 2" });
  });
});
