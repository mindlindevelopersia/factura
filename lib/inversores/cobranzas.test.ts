import { describe, expect, it } from "vitest";
import type { Pago } from "../finanzas/ingresos";
import type { SerieCac } from "../indicadores/cac";
import { ajustar, armarCobranzas, diaVencimiento, mensajeCobranza, saludo, telefonoWhatsapp, tipoDeConcepto, totalesCobranzas } from "./cobranzas";
import type { Cuenta, CuentasCorrientes, Movimiento } from "./cuentas";

// Un CAC inventado: sube 10 puntos por mes desde 100 en enero de 2026; octubre todavía no salió.
const valor = (indice: number) => ({ indice, mensual: null, anual: null, interanual: null });
const CAC: SerieCac = {
  avisos: [],
  ultimo: "2026-09",
  meses: Array.from({ length: 9 }, (_, i) => {
    const indice = 100 + i * 10;
    return { mes: `2026-0${i + 1}`, general: valor(indice), materiales: valor(indice), manoDeObra: valor(indice), provisorio: false, fila: 1 };
  }),
};

const pago = (mes: string, monto: number, extra: Partial<Pago> = {}): Pago => ({
  inversor: "Ana Pérez",
  unidad: "2A",
  tipo: "cuota",
  detalle: "Cuota mensual",
  bn: "blanco",
  moneda: "ARS",
  mes,
  monto,
  estado: "a-cobrar",
  atrasado: false,
  celda: `X${mes}${extra.tipo ?? ""}${extra.bn ?? ""}`,
  mesBase: "2026-03",
  ...extra,
});
const mov = (fecha: string, concepto: string, formal = true): Movimiento => ({ fecha, fechaTexto: "", monto: 1, moneda: "ARS", formal, tipoCambio: 1, usd: 1, numero: "", concepto, fila: 30 });

const cuenta = (extra: Partial<Cuenta>): Cuenta => ({
  id: "2a-ana-perez",
  inversor: "Ana Pérez & Juan Gómez",
  unidad: "2A",
  emprendimiento: "",
  cuit: "",
  telefono: "54 9 11 5555-1234",
  mesBaseCac: "2026-03",
  precioUsd: 1000,
  precioArs: null,
  formalUsd: 600,
  informalUsd: 400,
  pagos: [],
  notas: [],
  comentarios: [],
  pendientes: [],
  cobradoFlujo: [],
  origen: "planilla",
  columna: "L",
  avisos: [],
  ...extra,
});

describe("ajustar por CAC", () => {
  it("una cuota vencida se lleva a hoy con el índice del mes anterior", () => {
    // Cuota de julio (usa el CAC de junio, 150), hoy octubre (usa el de septiembre, 180).
    const r = ajustar(pago("2026-07", 1000), "2026-10", CAC, null);
    expect(r.factor).toBeCloseTo(180 / 150);
    expect(r.monto).toBeCloseTo(1200);
    expect(r.calculo).toContain("CAC sep 26 (180,0) ÷ CAC jun 26 (150,0)");
  });

  it("un refuerzo se ajusta desde el mes base", () => {
    // Base marzo (usa el CAC de febrero, 110).
    expect(ajustar(pago("2026-08", 1100, { tipo: "refuerzo", detalle: "Refuerzo 1" }), "2026-10", CAC, null).monto).toBeCloseTo(1800);
    expect(ajustar(pago("2026-08", 1100, { tipo: "refuerzo", mesBase: null }), "2026-10", CAC, "2026-05").monto).toBeCloseTo((1100 * 180) / 130);
    expect(ajustar(pago("2026-08", 1100, { tipo: "refuerzo", mesBase: null }), "2026-10", CAC, null).monto).toBe(null);
  });

  it("si el CAC que haría falta no salió, usa el monto del Flujo y lo dice", () => {
    expect(ajustar(pago("2026-10", 1000), "2026-10", CAC, null)).toMatchObject({ monto: 1000, factor: 1 });
    expect(ajustar(pago("2026-11", 1000), "2026-11", CAC, null).calculo).toMatch(/proyectado/);
  });

  it("los dólares no se ajustan", () => {
    expect(ajustar(pago("2026-07", 50, { moneda: "USD" }), "2026-10", CAC, null)).toMatchObject({ monto: 50, factor: 1 });
  });
});

describe("armarCobranzas", () => {
  const ana = cuenta({
    pendientes: [
      pago("2026-08", 1000),
      pago("2026-09", 1100, { bn: "negro" }),
      pago("2026-10", 1200),
      pago("2026-11", 1300),
      pago("2026-12", 1400),
    ],
  });
  const cc: CuentasCorrientes = { cuentas: [ana], avisos: [], mesActual: "2026-10" };

  it("vence el día 10: separa vencidos, este mes y el próximo", () => {
    const [c] = armarCobranzas(cc, CAC, "2026-10-08");
    expect(c.vencidos.map((i) => i.pago.mes)).toEqual(["2026-08", "2026-09"]);
    expect(c.esteMes.map((i) => i.pago.mes)).toEqual(["2026-10"]);
    expect(c.proximoMes.map((i) => i.pago.mes)).toEqual(["2026-11"]);
    expect(c.vencidos[0]).toMatchObject({ vence: "2026-08-10", diasVencido: 59 });
    const [despues] = armarCobranzas(cc, CAC, "2026-10-11");
    expect(despues.vencidos.map((i) => i.pago.mes)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("totales actualizados y solo lo formal en el mensaje", () => {
    const [c] = armarCobranzas(cc, CAC, "2026-10-08");
    // Agosto: 1000 × 180/160; septiembre (negro): 1100 × 180/170.
    expect(c.totalVencido.ARS).toBeCloseTo(1125 + (1100 * 180) / 170);
    expect(c.totalVencidoFormal.ARS).toBeCloseTo(1125);
    expect(c.mensaje).toContain("Hola Ana y Juan");
    expect(c.mensaje).toContain("Cuota mensual de agosto 2026: $ 1.125,00");
    expect(c.mensaje).not.toContain("septiembre");
    expect(c.mensaje).toContain("Tadeo – Administración Mindlin Developers");
    expect(c.whatsapp).toMatch(/^https:\/\/wa\.me\/5491155551234\?text=Hola/);
  });

  it("si no hay vencidos formales, el mensaje es un recordatorio de lo que vence este mes", () => {
    const [c] = armarCobranzas({ ...cc, cuentas: [cuenta({ pendientes: [pago("2026-10", 1200), pago("2026-09", 900, { bn: "negro" })] })] }, CAC, "2026-10-05");
    expect(c.mensaje).toContain("el 10 de octubre vence");
    const [solo] = armarCobranzas({ ...cc, cuentas: [cuenta({ pendientes: [pago("2026-09", 900, { bn: "negro" })] })] }, CAC, "2026-10-05");
    expect(solo.mensaje).toBe(null);
    expect(solo.whatsapp).toBe(null);
  });

  it("pide verificar si hay más pagos registrados que meses cobrados en el Flujo", () => {
    const pagada = cuenta({ pendientes: [pago("2026-09", 1000)], pagos: [mov("2026-09-09", "Cuota Mensual Septiembre")] });
    const [c] = armarCobranzas({ ...cc, cuentas: [pagada] }, CAC, "2026-10-20");
    expect(c.verificar[0]).toMatch(/Cuotas formales: hay 1 pago registrado/);
    expect(c.pagosPosteriores).toHaveLength(1);
    const ok = cuenta({ pendientes: [pago("2026-09", 1000)], pagos: [mov("2026-09-09", "Cuota Mensual Agosto")], cobradoFlujo: [pago("2026-09", 1, { estado: "cobrado", celda: "Y" })] });
    expect(armarCobranzas({ ...cc, cuentas: [ok] }, CAC, "2026-10-20")[0].verificar).toEqual([]);
  });

  it("pide verificar lo amarillo", () => {
    const [c] = armarCobranzas({ ...cc, cuentas: [cuenta({ pendientes: [pago("2026-09", 1000, { color: "amarillo" })] })] }, CAC, "2026-10-20");
    expect(c.verificar.some((v) => /amarillo/.test(v))).toBe(true);
  });

  it("Marcelo Martín vence el 20 y no aparece quien no debe nada", () => {
    const marcelo = cuenta({ id: "pb", inversor: "Marcelo Martin & Valeria Masson", unidad: "PB", pendientes: [pago("2026-10", 1000)] });
    const sinNada = cuenta({ id: "x", pendientes: [pago("2027-03", 1000)] });
    const r = armarCobranzas({ ...cc, cuentas: [marcelo, sinNada] }, CAC, "2026-10-15");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ dia: 20 });
    expect(r[0].esteMes).toHaveLength(1);
    expect(totalesCobranzas(r, "2026-10-15")).toMatchObject({ cuentasConVencidos: 0, esteMes: { ARS: 1000, USD: 0 } });
  });
});

describe("auxiliares", () => {
  it("día de vencimiento, saludo, teléfono y tipo de pago", () => {
    expect(diaVencimiento("Marcelo Martín & Valeria Masson")).toBe(20);
    expect(diaVencimiento("Lola Alegre")).toBe(10);
    expect(saludo("Octavio Sangiacomo / Jorgelina")).toBe("Octavio y Jorgelina");
    expect(saludo("Lola Alegre")).toBe("Lola");
    expect(telefonoWhatsapp("54 9 221 4283801")).toBe("5492214283801");
    expect(telefonoWhatsapp("972 58-400-9353")).toBe("972584009353");
    expect(telefonoWhatsapp("11 5873-0840")).toBe("5491158730840");
    expect(telefonoWhatsapp("")).toBe(null);
    expect(tipoDeConcepto("Cuota Mensual Abril")).toBe("cuota");
    expect(tipoDeConcepto("Refuerzo")).toBe("refuerzo");
    expect(tipoDeConcepto("Aporte Inicial")).toBe(null);
  });

  it("sin nada para avisar no hay mensaje", () => {
    expect(mensajeCobranza({ inversor: "Ana", unidad: "2A", vencidos: [], esteMes: [], dia: 10 })).toBe(null);
  });
});
