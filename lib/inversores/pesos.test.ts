import { describe, expect, it } from "vitest";
import type { Movimiento } from "./cuentas";
import { avanceEnPesos, type IndicesCac } from "./pesos";

// CAC inventado: sube 10% por mes desde dic-2024 (100).
const general: Record<string, number> = {};
["2024-12", "2025-01", "2025-02", "2025-03", "2025-04"].forEach((m, i) => (general[m] = 100 * 1.1 ** i));
const CAC: IndicesCac = { ultimo: "2025-04", general };

const pago = (fecha: string, monto: number, moneda: "ARS" | "USD", formal = true, fila = 1): Movimiento => ({
  fecha,
  fechaTexto: "",
  monto,
  moneda,
  formal,
  tipoCambio: moneda === "ARS" ? 1000 : null,
  usd: moneda === "USD" ? monto : monto / 1000,
  numero: "",
  concepto: "",
  fila,
});

describe("avance en pesos ajustados por CAC", () => {
  // Costo US$ 100.000 = $ 120.000.000 (TC del contrato 1.200), mes base enero 2025.
  const cuenta = {
    precioUsd: 100000,
    precioArs: 120_000_000,
    formalUsd: 60000,
    mesBaseCac: "2025-01",
    pagos: [pago("2025-01-15", 10000, "USD", true, 1), pago("2025-03-10", 13_200_000, "ARS", true, 2), pago("2025-04-10", 5_000_000, "ARS", false, 3)],
  };

  it("lleva costo y pagos al último CAC (el del mes anterior a hoy)", () => {
    const a = avanceEnPesos(cuenta, CAC, "2025-05")!;
    expect(a.mesCac).toBe("2025-04");
    expect(a.tipoCambioContrato).toBe(1200);
    // Costo: 120 M × CAC abr (100×1,1⁴) ÷ CAC dic (100).
    expect(a.costoHoy).toBeCloseTo(120_000_000 * 1.1 ** 4);
    // US$ 10.000 al TC del contrato = $ 12 M de enero → igual que el costo: 10% del total.
    expect(a.pagos[1].hoy! / a.costoHoy!).toBeCloseTo(0.1);
    // $ 13,2 M de marzo: × CAC abr ÷ CAC feb = × 1,1².
    expect(a.pagos[2].hoy).toBeCloseTo(13_200_000 * 1.1 ** 2);
    // $ 5 M de abril: × CAC abr ÷ CAC mar = × 1,1.
    expect(a.pagos[3].hoy).toBeCloseTo(5_000_000 * 1.1);
    expect(a.avance).toBeCloseTo(a.pagadoHoy / a.costoHoy!);
    expect(a.saldoHoy).toBeCloseTo(a.costoHoy! - a.pagadoHoy);
  });

  it("si el CAC de hoy todavía no salió, usa el último publicado; solo formal usa el monto formal", () => {
    const a = avanceEnPesos(cuenta, CAC, "2025-09", false)!;
    expect(a.mesCac).toBe("2025-04");
    expect(a.costoContrato).toBe(60000 * 1200);
    expect(Object.keys(a.pagos)).toEqual(["1", "2"]);
  });

  it("sin mes base no hay costo de hoy, pero los pagos se ajustan igual", () => {
    const a = avanceEnPesos({ ...cuenta, mesBaseCac: null }, CAC, "2025-05")!;
    expect(a.costoHoy).toBe(null);
    expect(a.falta).toBe("Falta el mes base CAC");
    expect(a.pagos[2].hoy).toBeCloseTo(13_200_000 * 1.1 ** 2);
    expect(avanceEnPesos(cuenta, null, "2025-05")).toBe(null);
  });
});
