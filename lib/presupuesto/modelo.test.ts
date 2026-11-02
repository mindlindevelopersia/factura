import { describe, expect, it } from "vitest";
import { asignarPago, calcularPresupuesto, filaDeItem, itemDeFila, plantilla, presupuestoHoy, validarItem, type ContextoPrecios, type ItemPresupuesto, type PagoCaja } from "./modelo";
import { RUBROS_BASE } from "./rubros";

const ctx: ContextoPrecios = { cac: (m) => ({ "2026-06": 100, "2026-09": 110 })[m] ?? null, cacHoy: { mes: "2026-09", indice: 110 }, mepHoy: 1500 };
const item = (id: string, o: Partial<ItemPresupuesto> = {}): ItemPresupuesto => ({ id, proyecto: "lerma-439", grupo: "hard", nombre: id, orden: 1, moneda: "USD", monto: null, baseCac: null, proveedor: "", estado: "estimado", faltaUsd: null, notas: "", actualizado: "", por: "", ...o });
const pago = (clave: string, descripcion: string, rubro: string, usd: number | null): PagoCaja => ({ clave, fecha: "2026-05-10", descripcion, rubro, moneda: "ARS", monto: (usd ?? 0) * 1200, usd });

describe("presupuesto de obra", () => {
  it("los pesos se ajustan por CAC desde el mes base y pasan a dólares al MEP de hoy", () => {
    expect(presupuestoHoy({ moneda: "USD", monto: 1000, baseCac: null }, ctx)).toEqual({ usd: 1000, arsAjustado: null, factorCac: null });
    const p = presupuestoHoy({ moneda: "ARS", monto: 15_000_000, baseCac: "2026-06" }, ctx);
    expect(p.factorCac).toBeCloseTo(1.1);
    expect(p.arsAjustado).toBeCloseTo(16_500_000);
    expect(p.usd).toBeCloseTo(11_000);
    // Sin mes base: no se ajusta.
    expect(presupuestoHoy({ moneda: "ARS", monto: 1_500_000, baseCac: null }, ctx).usd).toBe(1000);
  });

  it("cada pago va a su ítem: a mano, por palabras, por rubro de la caja o a ninguno", () => {
    const items = [item("estructura"), item("mamposteria"), item("electricidad")];
    expect(asignarPago(pago("a", "Pago Hormigonera", "hormigon", 1), items, {})).toBe("estructura");
    expect(asignarPago(pago("b", "JH albañilería 2do piso", "constructora", 1), items, {})).toBe("mamposteria");
    expect(asignarPago(pago("c", "Transferencia varios", "electricidad", 1), items, {})).toBe("electricidad");
    expect(asignarPago(pago("d", "Pago JH / Miranda", "constructora", 1), items, {})).toBeNull();
    expect(asignarPago(pago("d", "Pago JH / Miranda", "constructora", 1), items, { d: "mamposteria" })).toBe("mamposteria");
    // Elegido a mano como "ninguno": queda sin ítem aunque coincida.
    expect(asignarPago(pago("a", "Pago Hormigonera", "hormigon", 1), items, { a: "" })).toBeNull();
  });

  it("pagado + falta = costo final; lo sin ítem se suma igual; costo del m²", () => {
    const items = [item("estructura", { monto: 100_000 }), item("mamposteria", { monto: 50_000, faltaUsd: 70_000 }), item("terreno", { grupo: "terreno", monto: 400_000 })];
    const pagos = [pago("1", "Hormigón", "hormigon", 60_000), pago("2", "Albañilería JH", "constructora", 10_000), pago("3", "JH / Miranda", "constructora", 5_000), pago("4", "Compra lote", "terreno", 400_000), pago("5", "Sin MEP", "materiales", null)];
    const r = calcularPresupuesto(items, pagos, {}, ctx, 1000);
    const de = (id: string) => r.items.find((i) => i.id === id)!;
    expect(de("estructura")).toMatchObject({ pagadoUsd: 60_000, faltaCalculadaUsd: 40_000, costoFinalUsd: 100_000, desvioUsd: 0 });
    // Falta a mano: se pasa del presupuesto.
    expect(de("mamposteria")).toMatchObject({ pagadoUsd: 10_000, faltaCalculadaUsd: 70_000, costoFinalUsd: 80_000, desvioUsd: 30_000 });
    const hard = r.grupos.find((g) => g.id === "hard")!;
    expect(hard.sinItemUsd).toBe(5_000);
    expect(hard.costoFinalUsd).toBe(185_000);
    expect(r.total.costoFinalUsd).toBe(585_000);
    expect(r.costoM2).toBe(585);
    expect(r.sinMep).toBe(1);
  });

  it("la plantilla toma los montos del cash flow del Excel madre", () => {
    const p = plantilla("lerma-439", [{ nombre: "Estructura Mano de Obra", usd: 138_233 }, { nombre: "Estructura Materiales", usd: 120_000 }, { nombre: "Valor del terreno", usd: 450_000 }, { nombre: "Plusvalía + (Fee de desarrollador)", usd: 62_844 }], "Mati", "2026-11-02");
    expect(p).toHaveLength(RUBROS_BASE.length);
    expect(p.find((i) => i.id === "estructura")).toMatchObject({ monto: 258_233, moneda: "USD", estado: "estimado" });
    expect(p.find((i) => i.id === "terreno")?.monto).toBe(450_000);
    expect(p.find((i) => i.id === "aislaciones")?.monto).toBeNull();
    // La plusvalía no va.
    expect(p.reduce((s, i) => s + (i.monto ?? 0), 0)).toBe(708_233);
  });

  it("ida y vuelta por la planilla y validación", () => {
    const i = item("pintura", { moneda: "ARS", monto: 2_000_000, baseCac: "2026-09", faltaUsd: 500, proveedor: "Pinturas SA", estado: "cotizado" });
    expect(itemDeFila(filaDeItem(i))).toEqual(i);
    expect(validarItem({ monto: -1 })).toEqual({ error: "El monto no es un número válido." });
    expect(validarItem({ baseCac: "09/2026" })).toEqual({ error: "El mes base del CAC no es válido." });
    expect(validarItem({ monto: "", faltaUsd: null })).toEqual({ cambios: { monto: null, faltaUsd: null } });
  });
});
