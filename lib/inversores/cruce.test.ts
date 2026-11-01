import { describe, expect, it } from "vitest";
import type { Pago } from "../finanzas/ingresos";
import type { VentaMachete } from "../proyectos/comercial";
import type { Cuenta, CuentasCorrientes, Movimiento } from "./cuentas";
import { cruzarCuentas } from "./cruce";

const venta = (unidad: string, nombre: string, costo: number | null, boleto: number | null = null, blanco: number | null = null, negro: number | null = null, fila = 5): VentaMachete => ({
  nombre,
  tipo: "Costo",
  unidad,
  costoEstimado: costo,
  montoBoleto: boleto,
  blanco,
  negro,
  fila,
});
const anticipo = (usd: number): Movimiento => ({ fecha: "2025-02-01", fechaTexto: "", monto: usd, moneda: "USD", formal: true, tipoCambio: null, usd, numero: "", concepto: "Anticipo Inicial", fila: 23 });
const flujo = (mesBase: string): Pago => ({ inversor: "", unidad: "", tipo: "cuota", detalle: "", bn: "blanco", moneda: "ARS", mes: "2026-11", monto: 1, estado: "a-cobrar", atrasado: false, celda: "A1", mesBase });
const cuenta = (unidad: string, inversor: string, precioUsd: number | null, extra: Partial<Cuenta> = {}): Cuenta => ({
  id: `${unidad}-${inversor}`,
  inversor,
  unidad,
  emprendimiento: "",
  cuit: "",
  telefono: "",
  mesBaseCac: null,
  precioUsd,
  precioArs: null,
  formalUsd: null,
  informalUsd: null,
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
const cc = (cuentas: Cuenta[]): CuentasCorrientes => ({ cuentas, avisos: [], mesActual: "2026-11" });
const avisos = (r: CuentasCorrientes, unidad: string) => r.cuentas.filter((c) => c.unidad === unidad).flatMap((c) => c.avisos.map((a) => `${a.tipo}: ${a.titulo}`));

describe("cruce de las cuentas con Ventas y el Flujo", () => {
  it("completa el costo de Ventas y el mes base del Flujo cuando faltan", () => {
    const r = cruzarCuentas(cc([cuenta("2D", "Valentín Italiano", null, { pendientes: [flujo("2025-05")] })]), [venta("2D", "Valen Italiano", 74701)]);
    expect(r.cuentas[0]).toMatchObject({ precioUsd: 74701, mesBaseCac: "2025-05" });
    expect(avisos(r, "2D")).toEqual(["completado: Mes base CAC tomado del Flujo", "completado: Costo estimado tomado de Ventas"]);
  });

  it("avisa lo que no coincide: costo (sumando las cuentas de la unidad), nombre, anticipo, mes base y blanco + negro", () => {
    const r = cruzarCuentas(
      cc([
        cuenta("4D", "Alon Druck", 24471, { mesBaseCac: "2025-04", pendientes: [flujo("2025-03")] }),
        cuenta("4D", "Ioni Druck", 24471),
        cuenta("4D", "Sergio Druck", 24471),
        cuenta("5A", "Jorgelina Fulvia", 104770),
        cuenta("3C", "Sergio Druck", 150000, { pagos: [anticipo(29110)] }),
      ]),
      [venta("4D", "Alon + Ioni Druck", 73413, 15249, 1000, 1000), venta("5A", "J alimenti", 104770), venta("3C", "Sergio Druck", 160000, 28916, 28916, 0)],
    );
    expect(avisos(r, "4D")).toEqual(["cruce: El mes base CAC no coincide", "cruce: En Ventas, blanco + negro no da el boleto"]);
    expect(avisos(r, "5A")).toEqual(["cruce: El nombre no coincide con Ventas"]);
    expect(avisos(r, "3C")).toEqual(["cruce: El costo estimado no coincide con Ventas", "cruce: El anticipo no coincide con Ventas"]);
  });

  it("no avisa lo que ya explica una corrección del proyecto, ni las unidades sin vender", () => {
    const r = cruzarCuentas(cc([cuenta("4C", "Karina Arcuschin", 90000)]), [venta("4C", "Karina Arcuschin", 80000), venta("1B", "Falta vender", 0)], new Set(["4C"]));
    expect(avisos(r, "4C")).toEqual([]);
    expect(cruzarCuentas(cc([cuenta("4C", "Karina", 90000)]), null).cuentas[0].avisos).toEqual([]);
  });
});
