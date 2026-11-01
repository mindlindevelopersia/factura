import { describe, expect, it } from "vitest";
import { calcular, carpetaValida, datosVacios, desdeExcel, filaDePrefactibilidad, leerSuperficiesExcel, limpiarDatos, prefactibilidadDeFila, vendibleReal, vendibleTeorico, type Prefactibilidad } from "./modelo";

const hoy = "2026-11-02";
const base = () => {
  const d = datosVacios(hoy);
  d.terrenos = [{ nombre: "Terreno 1", frente: 10, fondo: 20 }];
  d.normativa.fos = 0.6;
  d.normativa.fot = 3;
  d.normativa.pisosMaximos = 3;
  d.pisos = [
    { nombre: "PB", cubierta: 100, semicubierta: 10, descubiertas: [{ nombre: "Patio", m2: 40, computa: 0 }], computaGcba: true },
    { nombre: "1er piso", cubierta: 150, semicubierta: 20, descubiertas: [{ nombre: "Terraza", m2: 30, computa: 0.5 }], computaGcba: true },
    { nombre: "SMA", cubierta: 20, semicubierta: 0, descubiertas: [], computaGcba: false },
  ];
  d.unidades = [
    { codigo: "1A", piso: "1", tipologia: "2 amb", cubierta: 50, semicubierta: 5, descubiertas: [{ nombre: "Terraza", m2: 30, computa: 0.33 }], real: null, nota: "" },
    { codigo: "1B", piso: "1", tipologia: "3 amb", cubierta: 80, semicubierta: 10, descubiertas: [], real: 85, nota: "Balcón grande" },
  ];
  return d;
};

describe("prefactibilidad", () => {
  it("los tres totales de lo construible, con cada descubierta a su %", () => {
    const c = calcular(base());
    expect(c.superficieTerreno).toBe(200);
    expect(c.construible.gcba).toBe(280); // 100+10 + 150+20 (la SMA no computa)
    expect(c.construible.conDescubiertas).toBe(315); // 110 + 0 + 170 + 15 + 20
    expect(c.construible.total).toBe(370); // todo al 100%
    expect(c.fosPermitido).toBe(120);
    expect(c.capacidadFot).toBe(600);
  });

  it("vendible teórico y real; comunes y % vendible", () => {
    const d = base();
    expect(vendibleTeorico(d.unidades[0])).toBe(64.9);
    expect(vendibleReal(d.unidades[1])).toBe(85);
    const c = calcular(d);
    expect(c.vendible.teorico).toBe(154.9);
    expect(c.vendible.real).toBe(149.9);
    expect(c.vendible.comunes).toBe(160.1);
    expect(c.vendible.porcentaje).toBeCloseTo(0.492, 3);
  });

  it("avisos: FOS excedido, pisos de más, falta FOS, real mayor que teórico", () => {
    const d = base();
    d.fosProyecto = 130;
    d.pisos.push({ nombre: "2do piso", cubierta: 1, semicubierta: 0, descubiertas: [], computaGcba: true }, { nombre: "3er piso", cubierta: 1, semicubierta: 0, descubiertas: [], computaGcba: true });
    d.unidades[0].real = 100;
    const textos = calcular(d).avisos.map((a) => a.texto);
    expect(textos.some((t) => t.startsWith("FOS excedido"))).toBe(true);
    expect(textos.some((t) => t.includes("4 plantas"))).toBe(true);
    expect(textos.some((t) => t.includes("más vendible real"))).toBe(true);
    d.normativa.fos = null;
    expect(calcular(d).avisos.some((a) => a.texto.startsWith("Falta el FOS"))).toBe(true);
  });

  it("limpia lo que llega: números negativos o texto, coeficientes de más de 1", () => {
    const d = limpiarDatos({ terrenos: [{ nombre: "T", frente: "8,65", fondo: -3 }], pisos: [{ nombre: "PB", cubierta: "x", descubiertas: [{ m2: 10, computa: 5 }] }] }, hoy);
    expect(d.terrenos[0]).toEqual({ nombre: "T", frente: 8.65, fondo: 0 });
    expect(d.pisos[0].cubierta).toBe(0);
    expect(d.pisos[0].descubiertas[0].computa).toBe(1);
    expect(d.pisos[0].computaGcba).toBe(true);
  });

  it("ida y vuelta por la fila (los datos van en JSON)", () => {
    const p: Prefactibilidad = { id: "p1", nombre: "Lote inventado", estado: "Asignada", proyecto: "lerma-439", carpeta: "https://drive.google.com/drive/folders/abc", creada: "2026-11-01T10:00:00.000Z", actualizada: "2026-11-02T10:00:00.000Z", edito: "Mati", datos: base() };
    expect(prefactibilidadDeFila(filaDePrefactibilidad(p))).toEqual(p);
    expect(prefactibilidadDeFila(["p2", "x", "Cualquiera", "", "", "2026-11-01T00:00:00Z", "", "", "no es json"]).estado).toBe("En análisis");
  });

  it("solo carpetas de Google Drive", () => {
    expect(carpetaValida("https://drive.google.com/drive/folders/abc")).toContain("drive.google.com");
    expect(carpetaValida("https://otro.com/x")).toBe("");
    expect(carpetaValida("javascript:alert(1)")).toBe("");
    expect(carpetaValida("")).toBe("");
  });

  it("lee la pestaña Superficies del Excel madre (con la forma de la de Lerma, números inventados)", () => {
    const c = (...v: (string | number | null)[]) => v.map((valor) => ({ valor }));
    const filas = [
      c(),
      c(null, "Dirección  lote", "Lote inventado 123"),
      c(null, "Distrito", "Tipologías edilicias", "Tipología", "Zonificación", "Basamento", "FOT RESIDENCIAL", "FOT COMERCIAL", "FOS"),
      c(),
      c(null, null, "7 + 2", null, "USAA", "No alcanzada", 3, null, 0.7),
      c(null, "Terreno 1", null, 10, 20, null, "N/A", "7+2", 22.8, 12, "2", "No"),
      c(null, "SUPERFICIES CONSTRUIBLES"),
      c(null, "PROYECTO:", null, null, "CUBIERTA", "Sem. CUBIERTA", "DESCUBIERTA"),
      c(null, "VIVIENDA"),
      c(null, "PB", null, null, 100, 10, 40),
      c(null, "1er piso", null, null, 150, 20, 0),
      c(null, "SMA /Az", null, null, 20, 0, 0),
      c(),
      c(null, "TOTALES"),
    ];
    const r = leerSuperficiesExcel(filas);
    expect(r.direccion).toBe("Lote inventado 123");
    expect(r.terreno).toEqual({ frente: 10, fondo: 20 });
    expect(r.normativa).toMatchObject({ tipologia: "7 + 2", zonificacion: "USAA", fot: 3, fos: 0.7, alturaMaxima: 22.8, pisosMaximos: 12 });
    expect(r.pisos.map((p) => p.nombre)).toEqual(["PB", "1er piso", "SMA /Az"]);
    const d = desdeExcel({ ...r, unidades: [{ codigo: "PBA", piso: "PB", tipologia: "3 amb", cubierta: 60, semicubierta: 0, descubierta: 30 }], hoy });
    expect(d.pisos[0].descubiertas[0]).toMatchObject({ m2: 40, computa: 0 });
    expect(d.pisos[2].computaGcba).toBe(false);
    expect(d.unidades[0].descubiertas[0].computa).toBe(0.2);
    expect(calcular(d).construible.gcba).toBe(280);
  });
});
