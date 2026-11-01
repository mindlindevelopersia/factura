import { describe, expect, it } from "vitest";
import { calcularHonorarios, costoM2, esCostoDelProyecto, type DatosHonorarios } from "./honorarios";

// El ejemplo de Mati: entra US$ 1.000.000 → 150.000 de honorarios; a US$ 3.000/m² son 50 m².
const base: DatosHonorarios = {
  parte: 0.15,
  cobradoUsd: 1_000_000,
  firmadoUsd: 2_000_000,
  libres: [
    { codigo: "7B", tipologia: "2 amb", m2: 50, precioUsd: 140_000 },
    { codigo: "8A", tipologia: "3 amb", m2: 100, precioUsd: 280_000 },
  ],
  m2Venta: 1000,
  costos: [
    { nombre: "Terreno", grupo: "terreno", usd: 1_000_000 },
    { nombre: "Obra", grupo: "obra", usd: 2_000_000 },
  ],
  gastadoUsd: 1_500_000,
  excluidos: [],
};

describe("honorarios de los desarrolladores", () => {
  it("el costo del m² es el costo total (con terreno, sin honorarios) sobre los m² vendibles", () => {
    expect(costoM2(base)).toBe(3000);
  });

  it("15% de lo que entró, pasado a m² al costo: 150.000 → 50 m²", () => {
    const h = calcularHonorarios(base);
    expect(h.hoy.honorariosUsd).toBe(150_000);
    expect(h.hoy.m2).toBe(50);
    // Precio de venta por defecto: el de lista de lo que queda (420.000 / 150 m² = 2.800).
    expect(h.precioVentaM2).toBe(2800);
    expect(h.hoy.valorVentaUsd).toBe(140_000);
  });

  it("lo firmado y el total (si se vende lo que queda a lista)", () => {
    const h = calcularHonorarios(base);
    expect(h.firmado.honorariosUsd).toBe(300_000);
    expect(h.total.ingresosUsd).toBe(2_420_000);
    expect(h.total.honorariosUsd).toBeCloseTo(363_000);
    expect(h.m2ParteDeLosMetros).toBe(150);
  });

  it("control: con el 85% de los ingresos, ¿alcanza para la obra?", () => {
    const h = calcularHonorarios(base);
    expect(h.obra.paraLaObraUsd).toBeCloseTo(2_057_000);
    expect(h.obra.sobraUsd).toBeCloseTo(-943_000);
    // Hasta hoy: entró 1.000.000 → 850.000 para la obra; se gastaron 1.500.000.
    expect(h.obraHoy).toEqual({ paraLaObraUsd: 850_000, gastadoUsd: 1_500_000, sobraUsd: -650_000 });
  });

  it("valores elegidos a mano y unidades separadas", () => {
    const h = calcularHonorarios(base, { costoM2: 2000, precioVentaM2: 2800, separadas: ["8A", "ZZ"] });
    expect(h.costoM2).toBe(2000);
    expect(h.hoy.m2).toBe(75);
    expect(h.separadas).toMatchObject({ codigos: ["8A"], m2: 100, valorCostoUsd: 200_000, valorListaUsd: 280_000 });
    expect(h.separadas!.cubre).toBeCloseTo(200_000 / 363_000);
    expect(h.separadas!.diferenciaUsd).toBeCloseTo(163_000);
  });

  it("no son costo: préstamos, devoluciones y los honorarios de los desarrolladores", () => {
    expect(esCostoDelProyecto({ nombre: "Préstamo Borok", grupo: "prestamos" })).toBe(false);
    expect(esCostoDelProyecto({ nombre: "Honorarios Developers", grupo: "honorarios" })).toBe(false);
    expect(esCostoDelProyecto({ nombre: "Honorarios arquitecto", grupo: "honorarios" })).toBe(true);
    expect(esCostoDelProyecto({ nombre: "Terreno", grupo: "terreno" })).toBe(true);
  });
});
