import { describe, expect, it } from "vitest";
import {
  clasificar,
  diaDeFecha,
  egresosACsv,
  egresosPorMes,
  filtrarEgresos,
  filtrosEgresosAUrl,
  filtrosEgresosDeUrl,
  leerCaja,
  porConcepto,
  porRubro,
  resumenInternos,
  SIN_FILTROS_EGRESOS,
  tipoInterno,
  totalesEgresos,
  unir,
} from "./egresos";
import type { Celda } from "./ingresos";

// Datos inventados con la forma de "Caja Flujos en Pesos" (los egresos van en negativo).
const ENCABEZADOS = ["Fecha", "Tipo de Operación", "Inversor", "Origen de los Fondos", "Rubro/Descripción", "Conciliación", "Corresponde", "Forma de Pago/Cobro", "Legalidad", "Banco", "Importe Total"];
const c = (valor: Celda["valor"]): Celda => ({ valor, color: null });
// 46082 = 1/3/2026 en número de serie de Sheets.
const MARZO = 46082;
const ABRIL = MARZO + 31;
const fila = (fecha: number | null, tipo: string, descripcion: string, categoria: string, proyecto: string, bn: string, importe: number | string): Celda[] =>
  [fecha, tipo, null, "Mindlin Developers", descripcion, categoria, proyecto, "Transferencia", bn, "Galicia", importe].map((v) => c(v));

const PESOS: Celda[][] = [
  ENCABEZADOS.map(c),
  fila(MARZO, "Egreso", "Pago Hormigonera", "Materiales", "Lerma 439", "Blanco", -1000),
  fila(MARZO + 5, "Egreso", "Transferencia a Herpaco", "Materiales", "Lerma 439", "Blanco", -800),
  fila(ABRIL, "Egreso", "Pago JH / Miranda", "Servicios de terceros", "Lerma 439", "Negro", -500),
  fila(ABRIL, "Egreso", "IIBB", "Impuestos", "HQ", "Blanco", -50),
  fila(ABRIL, "Egreso", "Compra Dólares", "Caja", "HQ", "Blanco", -9000),
  fila(ABRIL, "Egreso", "Susc FIMA", "Caja", "HQ", "Blanco", -7000),
  fila(ABRIL, "Egreso", "Cuota Inversor Inventado", "Caja", "HQ", "Blanco", 3000),
  fila(ABRIL, "Ingreso", "Depósito", "Caja", "HQ", "Blanco", 5000),
  fila(null, "Egreso", "imp arqueo", "Impuestos", "HQ", "Blanco", -10),
  fila(ABRIL, "Egreso", "Algo raro", "Caja", "HQ", "Blanco", -70),
  fila(ABRIL, "Egreso", "Algo raro", "Caja", "HQ", "Blanco", -30),
  fila(ABRIL, "Egreso", "Texto en importe", "Caja", "HQ", "Blanco", "pendiente"),
];
// En dólares, los egresos van en positivo.
const DOLARES: Celda[][] = [
  ENCABEZADOS.map(c),
  fila(MARZO, "Egreso", "Compra Lote Escritura", "Caja", "Lerma 439", "Blanco", 300),
  fila(ABRIL, "Egreso", "Pago Miranda C5", "Servicios de terceros", "Lerma 439", "Negro", 20),
  fila(ABRIL, "Egreso", "Venta dólares", "Caja", "HQ", "Negro", 40),
  fila(ABRIL, "Egreso", "Pago sin legalidad", "Honorarios", "HQ", "", 5),
  fila(ABRIL, "Egreso", "Tranf a Borok", "Caja", "HQ", "Blanco", 50000),
  fila(ABRIL, "Egreso", "Devolución inversor", "Caja", "Lerma 439", "Blanco", 1000),
];

const caja = unir(leerCaja(PESOS, "ARS", "Caja Flujos en Pesos", "2026-10"), leerCaja(DOLARES, "USD", "Caja Flujos en Dólares Global", "2026-10"));
const pesos = caja.egresos.filter((e) => e.moneda === "ARS");

describe("leerCaja", () => {
  it("los préstamos (Borok) y las devoluciones no existen para el hub", () => {
    expect(caja.egresos.some((e) => /borok|devoluci/i.test(e.descripcion))).toBe(false);
  });

  it("toma solo los egresos, en positivo, con fecha, mes, proyecto y blanco/negro", () => {
    expect(pesos[0]).toMatchObject({ fecha: "2026-03-01", mes: "2026-03", descripcion: "Pago Hormigonera", rubro: "hormigon", proyecto: "Lerma 439", bn: "blanco", monto: 1000, fila: 2 });
    expect(caja.egresos.some((e) => e.descripcion === "Depósito")).toBe(false);
  });

  it("clasifica los rubros por la descripción y, si no, por la categoría", () => {
    const rubro = (d: string) => caja.egresos.find((e) => e.descripcion === d)?.rubro;
    expect(rubro("Transferencia a Herpaco")).toBe("hierro");
    expect(rubro("Pago JH / Miranda")).toBe("constructora");
    expect(rubro("Pago Miranda C5")).toBe("constructora");
    expect(rubro("Compra Lote Escritura")).toBe("terreno");
    expect(rubro("IIBB")).toBe("impuestos");
    expect(rubro("Pago sin legalidad")).toBe("honorarios");
  });

  it("separa los movimientos internos y no los cuenta como egreso", () => {
    expect(caja.egresos.some((e) => /dolar|fima/i.test(e.descripcion))).toBe(false);
    expect(resumenInternos(caja.internos)).toEqual([
      { tipo: "Compra y venta de dólares", moneda: "ARS", total: 9000, cantidad: 1 },
      { tipo: "FIMA (inversión)", moneda: "ARS", total: 7000, cantidad: 1 },
      { tipo: "Compra y venta de dólares", moneda: "USD", total: 40, cantidad: 1 },
    ]);
  });

  it("un egreso con el signo al revés no se cuenta y va a revisar como posible ingreso", () => {
    expect(caja.egresos.some((e) => e.descripcion.startsWith("Cuota"))).toBe(false);
    expect(caja.avisos.find((a) => a.tipo === "signo")).toMatchObject({ filas: [8], monto: 3000, moneda: "ARS" });
  });

  it("cuenta lo que no tiene fecha o blanco/negro, y lo avisa", () => {
    expect(caja.egresos.find((e) => e.descripcion === "imp arqueo")).toMatchObject({ fecha: null, mes: null, monto: 10 });
    expect(caja.avisos.find((a) => a.tipo === "sin-fecha")).toMatchObject({ filas: [10], moneda: "ARS" });
    expect(caja.egresos.find((e) => e.descripcion === "Pago sin legalidad")?.bn).toBe(null);
    expect(caja.avisos.find((a) => a.tipo === "sin-bn")).toMatchObject({ moneda: "USD", monto: 5 });
  });

  it("agrupa lo sin clasificar por descripción, en un solo aviso", () => {
    const sin = caja.avisos.filter((a) => a.tipo === "sin-clasificar");
    expect(sin).toHaveLength(1);
    expect(sin[0]).toMatchObject({ titulo: 'Sin rubro: "Algo raro"', filas: [11, 12], monto: 100 });
  });

  it("no cuenta un importe que no es número, y lo avisa", () => {
    expect(caja.avisos.some((a) => a.tipo === "dato-raro" && a.filas.includes(13))).toBe(true);
  });

  it("dice qué columnas faltan", () => {
    expect(() => leerCaja([[c("Fecha"), c("Importe Total")]], "ARS", "X", "2026-10")).toThrow(/Tipo de Operación/);
  });
});

describe("totales y agrupaciones", () => {
  it("totales por moneda, con blanco, negro y sin dato", () => {
    const t = totalesEgresos(caja.egresos);
    expect(t.ARS).toMatchObject({ total: 1000 + 800 + 500 + 50 + 10 + 100, blanco: 1960, negro: 500, sinDato: 0 });
    expect(t.USD).toMatchObject({ total: 325, blanco: 300, negro: 20, sinDato: 5 });
  });

  it("por rubro, de mayor a menor y con la parte del total", () => {
    const r = porRubro(caja.egresos, "ARS");
    expect(r.map((f) => f.rubro)).toEqual(["hormigon", "hierro", "constructora", "sin-clasificar", "impuestos"]);
    expect(r[0].parte).toBeCloseTo(1000 / 2460);
  });

  it("por concepto: los que más gastaron y el resto en Otros", () => {
    const { filas, otros } = porConcepto(caja.egresos, "ARS", 2);
    expect(filas.map((f) => f.descripcion)).toEqual(["Pago Hormigonera", "Transferencia a Herpaco"]);
    expect(otros).toMatchObject({ total: 660, cantidad: 5 });
  });

  it("por mes sin huecos y con acumulado", () => {
    const m = egresosPorMes(caja.egresos, "ARS");
    expect(m.map((x) => [x.mes, x.total, x.acumulado])).toEqual([
      ["2026-03", 1800, 1800],
      ["2026-04", 650, 2450],
    ]);
  });
});

describe("filtros", () => {
  it("filtra por rango, moneda, blanco/negro, rubro, proyecto y texto", () => {
    expect(filtrarEgresos(caja.egresos, { ...SIN_FILTROS_EGRESOS, desde: "2026-04", moneda: "ARS" }).map((e) => e.monto)).toEqual([500, 50, 70, 30]);
    expect(filtrarEgresos(caja.egresos, { ...SIN_FILTROS_EGRESOS, rubro: "constructora", bn: "negro" })).toHaveLength(2);
    expect(filtrarEgresos(caja.egresos, { ...SIN_FILTROS_EGRESOS, proyecto: "HQ", moneda: "ARS" })).toHaveLength(4);
    expect(filtrarEgresos(caja.egresos, { ...SIN_FILTROS_EGRESOS, q: "herpáco" }).map((e) => e.descripcion)).toEqual(["Transferencia a Herpaco"]);
  });

  it("van y vuelven de la URL, ignorando valores inválidos", () => {
    const f = { ...SIN_FILTROS_EGRESOS, desde: "2026-01", rubro: "hierro" as const, q: "Herpaco" };
    expect(filtrosEgresosDeUrl(new URLSearchParams(filtrosEgresosAUrl(f)))).toEqual(f);
    expect(filtrosEgresosDeUrl(new URLSearchParams("rubro=oro&moneda=EUR&bn=gris"))).toEqual(SIN_FILTROS_EGRESOS);
  });
});

describe("auxiliares", () => {
  it("clasifica y reconoce movimientos internos", () => {
    expect(clasificar("Pago Seg e Higiene", "Servicios de terceros")).toBe("honorarios");
    expect(clasificar("Pago ABL", "Seguros")).toBe("impuestos");
    expect(clasificar("Pago Cámara Transformadora", "Materiales")).toBe("electricidad");
    expect(clasificar("Cualquier cosa", "Caja")).toBe("sin-clasificar");
    expect(tipoInterno("Compra dòlares", "Caja")).toBe("Compra y venta de dólares");
    expect(tipoInterno("Transf MP a Galicia", "Caja")).toBe("Transferencias entre cuentas propias");
    expect(tipoInterno("Transferencia Costa Materiales", "Materiales")).toBe(null);
  });

  it("lee fechas", () => {
    expect(diaDeFecha(MARZO)).toBe("2026-03-01");
    expect(diaDeFecha("5/4/2026")).toBe("2026-04-05");
    expect(diaDeFecha("#VALUE!")).toBe(null);
  });

  it("exporta CSV con punto y coma y coma decimal", () => {
    const csv = egresosACsv(pesos.slice(0, 1));
    expect(csv.startsWith("﻿Fecha;Descripción;Rubro")).toBe(true);
    expect(csv).toContain("2026-03-01;Pago Hormigonera;Hormigón;Materiales;Lerma 439;Blanco;ARS;1000,00;Transferencia;Galicia;Caja Flujos en Pesos;2");
  });
});
