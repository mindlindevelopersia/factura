import { describe, expect, it } from "vitest";
import type { Celda } from "../finanzas/ingresos";
import { SOCIOS } from "../modulos";
import { armarComercial, codigoDeVentas, leerSuperficies, precioDepto, precioSimulado, resumen } from "./comercial";
import { analizarHq, desarrolladores, m2DesarrolladoresEnPlanilla } from "./management";

const c = (valor: Celda["valor"]): Celda => ({ valor, color: null });
const fila = (...v: Celda["valor"][]) => v.map(c);

// Una "Lista de precios" inventada con la forma de la de Lerma (precio base 2.600 y 1,5% por piso).
const TITULOS = fila("Inversor", "Estado", "Piso", "Letra", "UF", "Tipología", "Orientación", "Sup. Cubierta", "Sup. Semi Cubierta", "Sup. Descub (50%)", "Ajuste m2 x terraza ", "Sup Propia (M2)", "Sup Propia VENTA (M2)", "Coeficiente", "Superficie Amenities", "Valor UF (Sin Amenities)", "Valor UF (Con Amenities)", "Aumento por altura", "Sup Total", "Precio x M2 (Contado)", "Precio (Contado)", "Precio x M2 (Financiado)", "Aporte total estimado");
const unidad = (inversor: string, estado: string, piso: string | number, letra: string, venta: number, amenities: number, uf: number) => {
  const conAmenities = (venta + amenities) * 2600;
  const nivel = piso === "PB" ? 0 : Number(piso);
  const altura = nivel > 1 ? (nivel - 1) * 0.015 * conAmenities : 0;
  return fila(inversor, estado, piso, letra, uf, "2 ambientes", "Frente", venta, 0, 0, 1, venta, venta, 0.1, amenities, venta * 2600, conAmenities, altura, venta + amenities, 2600, null, null, conAmenities + altura);
};
const LISTA: Celda[][] = [
  fila("Precios vigentes"),
  TITULOS,
  unidad("Ana", "Vendido", "PB", "A", 90, 5, 1),
  unidad("Miranda", "Libre", 1, "A", 40, 2, 2),
  unidad("", "Libre", 1, "B", 30, 2, 3),
  unidad("Beto", "Vendido", 2, "A", 80, 4, 4),
  unidad("Sin cuenta", "Vendido", 3, "A", 40, 2, 5),
  fila("L Alegre", "Vendido", "PB", "A", "C1", "Cochera", null, null, null, null, null, null, null, null, null, null, null, null, null, null, 25000, null, 25000),
  fila(null, "Los montos son previstos."),
  fila(null, "Libre", 9, "B", 6, "2 ambientes"),
];
const VENTAS: Celda[][] = [
  fila(null, "Nombre", "Tipo", "Unidad", "M2 VENTA PROPIA", "M2 VENTA AMENITIES", "Costo estimado", "Monto al boleto", "Blanco", "Negro"),
  fila(null, "Ana", "Costo", "Planta Baja", 90, 95, 200000, 50000, 10000, 40000),
  fila(null, "Miranda", "Canjeado", "1A", 40, 42, 100000),
  fila(null, "Beto", "Costo", "2AyB", 80, 84, 180000),
  fila(null, "Total"),
  fila(null, null, null, null, "¿A cuanto vendimos?", null, 2300),
];
const SUP: Celda[][] = [
  fila(null, "Superficie total", null, null, null, 194.62),
  fila(null, "TOTALES", null, null, 1500, 180, 100),
  fila(null, "CONSTRUIBLES AL", null, 1727.68),
  fila(null, "VENDIBLES"),
  fila(null, "TOTAL CONSTRUIBLE", null, null, 1187, 70, 53, 1370.41, 357.27, 1727.68),
];
const CUENTAS = [
  { unidad: "PB", inversor: "Ana", precioUsd: 200000 },
  { unidad: "1A", inversor: "Miranda", precioUsd: 100000 },
  { unidad: "2A", inversor: "Beto", precioUsd: 180000 },
];

const com = armarComercial(LISTA, VENTAS, SUP, CUENTAS);

describe("comercial", () => {
  it("lee las unidades de la lista hasta las notas y deja afuera las variantes", () => {
    expect(com.unidades.map((u) => [u.codigo, u.estado])).toEqual([
      ["PB", "vendida"],
      ["1A", "libre"],
      ["1B", "libre"],
      ["2A", "vendida"],
      ["3A", "vendida"],
      ["C1", "vendida"],
    ]);
    expect(com.supuestos.some((s) => /debajo de la lista/.test(s.titulo) && s.detalle.includes("9B"))).toBe(true);
  });

  it("deduce el precio base y el aumento por piso", () => {
    expect(com.precioBaseM2).toBeCloseTo(2600);
    expect(com.aumentoPorPiso).toBeCloseTo(0.015);
  });

  it("toma el precio de venta del machete de Ventas (o de la cuenta) y el promedio de la planilla", () => {
    const u = (cod: string) => com.unidades.find((x) => x.codigo === cod)!;
    expect(u("PB").precioVenta).toBe(200000);
    expect(u("2A").precioVenta).toBe(180000);
    expect(u("PB").venta?.blanco).toBe(10000);
    expect(u("1A").precioVenta).toBe(null);
    expect(com.promedioVentaPlanilla).toEqual([2300]);
  });

  it("marca los conflictos entre la lista, el machete y las cuentas", () => {
    const titulos = com.supuestos.filter((s) => s.tipo === "conflicto").map((s) => s.titulo);
    expect(titulos).toContain("1A: libre en la lista, con venta en el machete");
    expect(titulos).toContain("1A: libre en la lista, pero con inversor");
    expect(titulos).toContain("1A: libre en la lista, con cuenta corriente");
    expect(titulos).toContain("3A: vendida, sin cuenta corriente");
  });

  it("cruza el precio de venta de Ventas con el de Pagos por Inversor y salta la fila 'Falta vender'", () => {
    const ventas = [...VENTAS.slice(0, 1), fila(null, "Falta vender", null, "Planta Baja", 90, 95, 999999), ...VENTAS.slice(2)];
    const otra = armarComercial(LISTA, ventas, SUP, [...CUENTAS.filter((x) => x.unidad !== "2A"), { unidad: "2A", inversor: "Beto", precioUsd: 190000 }]);
    const u = (cod: string) => otra.unidades.find((x) => x.codigo === cod)!;
    // PB no tiene machete (la fila es "Falta vender"): el precio sale de la cuenta.
    expect(u("PB").venta).toBe(null);
    expect(u("PB").precioVenta).toBe(200000);
    // 2A: Ventas dice 180.000 y la cuenta 190.000 → manda Ventas, con alarma.
    expect(u("2A").precioVenta).toBe(180000);
    expect(u("2A").precioCuenta).toBe(190000);
    expect(otra.supuestos.map((s) => s.titulo)).toContain("2A: el precio de venta no coincide");
    // Con una corrección que lo explica (por ejemplo, un mutuo por más que lo cobrado), no hay alarma.
    const explicada = armarComercial(LISTA, ventas, SUP, [...CUENTAS.filter((x) => x.unidad !== "2A"), { unidad: "2A", inversor: "Beto", precioUsd: 190000 }], [{ codigo: "2A", motivo: "Mutuo.", desde: "31/10/2026" }]);
    expect(explicada.supuestos.map((s) => s.titulo)).not.toContain("2A: el precio de venta no coincide");
    expect(com.supuestos.map((s) => s.titulo)).not.toContain("2A: el precio de venta no coincide");
  });

  it("todas al costo; precio cerrado y tope solo por corrección; canje por machete o contrato", () => {
    const ventas = VENTAS.map((f) => (f[1]?.valor === "Beto" ? fila(null, "Beto", "Contado", "2AyB", 80, 84, 180000) : f));
    const m = armarComercial(LISTA, ventas, SUP, CUENTAS, [
      { codigo: "PB", modalidad: "costo", tope: 0.07, aConfirmar: true, motivo: "Tope.", desde: "31/10/2026" },
      { codigo: "3A", modalidad: "cerrado", motivo: "Cerrado.", desde: "31/10/2026" },
    ]);
    const u = (cod: string) => m.unidades.find((x) => x.codigo === cod)!;
    expect(u("PB")).toMatchObject({ modalidad: "costo", tope: 0.07 });
    // "Contado" en Ventas es cómo pagó, no precio cerrado.
    expect(u("2A").modalidad).toBe("costo");
    expect(u("3A").modalidad).toBe("cerrado");
    expect(u("1A").modalidad).toBe(null);
    expect(u("C1").modalidad).toBe(null);
    expect(resumen(m.unidades).modalidades).toEqual({ costo: 2, cerrado: 1, canje: 0 });
    expect(m.supuestos.map((s) => s.titulo)).toContain("El coeficiente supone que se venden todas las unidades");
    expect(m.supuestos.find((s) => s.titulo.startsWith("PB:"))?.tipo).toBe("por-confirmar");
  });

  it("cocheras incluidas en el precio de un depto: se descuentan para el US$/m²", () => {
    const m = armarComercial(LISTA, VENTAS, SUP, CUENTAS, [{ codigo: "C1", precio: 20000, incluidaEn: "2A", motivo: "Con la 2A.", desde: "31/10/2026" }]);
    const u = (cod: string) => m.unidades.find((x) => x.codigo === cod)!;
    expect(u("C1")).toMatchObject({ precioVenta: 20000, incluidaEn: "2A" });
    expect(u("2A")).toMatchObject({ precioVenta: 180000, precioCochera: 20000 });
    expect(precioDepto(u("2A"))).toBe(160000);
    const r = resumen(m.unidades);
    expect(r.vendido).toMatchObject({ total: 380000, deptos: 360000, cocheras: 20000 });
    expect(r.vendido.promedioM2).toBeCloseTo(360000 / (95 + 84));
  });

  it("aplica las correcciones: reventa, venta caída y contrato", () => {
    const aj = armarComercial(LISTA, VENTAS, SUP, CUENTAS, [
      { codigo: "1A", estado: "vendida", contrato: true, reventa: 105000, motivo: "Contratista; se revende.", desde: "31/10/2026" },
      { codigo: "2A", estado: "libre", motivo: "No se firmó.", desde: "31/10/2026" },
      { codigo: "3A", contrato: true, motivo: "Contratista.", desde: "31/10/2026" },
    ]);
    const u = (cod: string) => aj.unidades.find((x) => x.codigo === cod)!;
    expect(u("1A")).toMatchObject({ estado: "vendida", contrato: true, reventa: 105000, precioVenta: 100000, modalidad: "canje" });
    expect(u("2A")).toMatchObject({ estado: "libre", inversor: "", venta: null });
    const titulos = aj.supuestos.map((s) => s.titulo);
    expect(titulos).not.toContain("1A: libre en la lista, pero con inversor");
    expect(titulos).not.toContain("3A: vendida, sin cuenta corriente");
    expect(titulos).toContain("1A: vendida, pagada con contrato, en reventa");
    // 2A pasó a libre con corrección: su machete viejo no es conflicto.
    expect(titulos).not.toContain("2A: libre en la lista, con venta en el machete");
    expect(aj.supuestos.find((s) => s.titulo === "2A: libre")?.detalle).toMatch(/dice "Vendido"/);
    const r = resumen(aj.unidades);
    expect(r.enReventa).toEqual({ cantidad: 1, total: 105000 });
    expect(r.vendidas).toBe(3);
  });

  it("resumen: vendidas, m², promedio de venta y lo que falta vender a lista", () => {
    const r = resumen(com.unidades);
    expect(r).toMatchObject({ deptos: 5, vendidas: 3, libres: 2, cocheras: { total: 1, vendidas: 1 } });
    expect(r.m2.total).toBeCloseTo(95 + 42 + 32 + 84 + 42);
    expect(r.vendido.promedioM2).toBeCloseTo(380000 / (95 + 84));
    expect(r.porVender).toBeCloseTo(42 * 2600 + 32 * 2600);
  });

  it("simula otra lista", () => {
    const u = com.unidades.find((x) => x.codigo === "2A")!;
    expect(precioSimulado(u, 2800, 0.02)).toBeCloseTo(84 * 2800 * 1.02);
    expect(precioSimulado(u, 2600, 0.015)).toBeCloseTo(u.precioLista);
  });

  it("lee las superficies y los códigos del machete", () => {
    expect(leerSuperficies(SUP)).toEqual({
      terreno: 194.62,
      construccion: { cubierta: 1500, semicubierta: 180, descubierta: 100 },
      construibles: 1727.68,
      vendibles: { propios: 1370.41, comunes: 357.27, total: 1727.68 },
    });
    expect(codigoDeVentas("6 AyB")).toBe("6A");
    expect(codigoDeVentas("Planta Baja")).toBe("PB");
    expect(codigoDeVentas("1A")).toBe("1A");
  });
});

describe("management", () => {
  it("15% de los m² de venta, sin amenities, repartido 50/25/25", () => {
    const hq = analizarHq([]);
    const d = desarrolladores(com.unidades, 0.15, SOCIOS, 50, hq);
    expect(d.m2).toBeCloseTo(0.15 * (90 + 40 + 30 + 80 + 40));
    expect(d.socios.map((s) => s.m2 / d.m2)).toEqual([0.5, 0.25, 0.25]);
    expect(d.supuestos.map((s) => s.tipo)).toEqual(["confirmado", "por-confirmar", "confirmado"]);
  });

  it("separa los egresos de HQ en duda (obra, préstamo, grandes, banco) y los de oficina", () => {
    const e = (proyecto: string, rubro: string, moneda: "ARS" | "USD", monto: number, descripcion = "", fila = 1) => ({ proyecto, rubro, moneda, monto, descripcion, fecha: null, pestania: "Caja", fila });
    const hq = analizarHq([
      e("HQ", "impuestos", "ARS", 100, "Deb", 5),
      e("HQ", "bancarios", "ARS", 50, "", 6),
      e("HQ", "hormigon", "ARS", 1000, "Pago Hormigonera", 7),
      e("HQ", "prestamos", "USD", 50000, "Tranf a Borok 1", 2),
      e("HQ", "sin-clasificar", "USD", 8000, "Otra", 3),
      e("HQ", "honorarios", "ARS", 300, "Contador", 4),
      e("Lerma 439", "materiales", "ARS", 9),
      e("Sin proyecto", "prestamos", "USD", 75000, "Egresos Borok", 68),
    ]);
    expect(hq).toMatchObject({ movimientos: 6, ARS: 1450, USD: 58000, oficina: { movimientos: 1, ARS: 300, USD: 0 } });
    expect(hq.revisar.map((x) => [x.duda, x.descripcion])).toEqual([
      ["obra", "Pago Hormigonera"],
      ["prestamo", "Tranf a Borok 1"],
      ["prestamo", "Egresos Borok"],
      ["grande", "Otra"],
      ["banco", "Deb"],
      ["banco", ""],
    ]);
    const d = desarrolladores(com.unidades, 0.15, SOCIOS, null, hq);
    const s = d.supuestos.at(-1)!;
    expect(s.titulo).toBe("Para que revise Tadeo: 5 de 6 egresos marcados como HQ");
    expect(s.detalle).toMatch(/1 parecen de la obra .*2 préstamos \(US\$ 125\.000\).*2 impuestos y gastos del banco/);
    expect(s.detalle).toMatch(/Quedan 1 de oficina/);
    expect(d.hq).toBe(hq);
  });

  it("lee los m² de developers de EE.RR", () => {
    expect(m2DesarrolladoresEnPlanilla([fila(null, "M2 canjeados a Developers", null, 243.18)])).toBe(243.18);
    expect(m2DesarrolladoresEnPlanilla([fila("otra cosa")])).toBe(null);
  });
});
