import { describe, expect, it } from "vitest";
import type { Invoice } from "../invoice/schema";
import { nombreArchivo } from "../storage/archivos";
import { COLUMNAS, filaPlanilla, letraColumna } from "./columnas";

const invoice: Invoice = {
  fecha_factura: "2026-09-15",
  tipo_comprobante: "factura",
  letra: "A",
  codigo_arca: null,
  punto_venta: 3,
  numero: 1234,
  razon_social: "Corralón Ejemplo S.A.",
  cuit: "33693450239",
  cuit_receptor: null,
  concepto: "Cemento",
  moneda: "ARS",
  tipo_cambio: null,
  neto_gravado: 1000,
  no_gravado: 0,
  iva_21: 210,
  iva_10_5: 0,
  iva_otras: 0,
  percepcion_iva: 0,
  percepcion_iibb_caba: 0,
  percepcion_iibb_pba: 0,
  otros_tributos: 0,
  total: 1210,
  cae: "75123456789012",
  cae_vencimiento: null,
  rubro: "Materiales",
  proyecto: "Lerma",
  campos_dudosos: [],
  observaciones: null,
};

const datos = { invoice, fechaRegistro: "2026-10-28", link: "https://drive.google.com/x", cargadoPor: "ana@mindlin.com.ar" };

function celda(fila: (string | number)[], titulo: string) {
  return fila[COLUMNAS.findIndex((c) => c.titulo === titulo)];
}

describe("filaPlanilla", () => {
  it("arma la fila en el orden de las columnas", () => {
    const fila = filaPlanilla(datos);
    expect(fila).toHaveLength(COLUMNAS.length);
    expect(celda(fila, "Tipo de comprobante")).toBe("Factura A");
    expect(celda(fila, "N°")).toBe("00003-00001234");
    expect(celda(fila, "CUIT")).toBe("33-69345023-9");
    expect(celda(fila, "Moneda")).toBe("$");
    expect(celda(fila, "Neto gravado")).toBe(1000);
    expect(celda(fila, "IVA 10,5%")).toBe("");
    expect(celda(fila, "Forma de pago")).toBe("");
    expect(celda(fila, "Estado")).toBe("En revisión");
    expect(celda(fila, "CAE")).toBe("'75123456789012");
    expect(celda(fila, "Clave")).toBe("'33693450239|1|00003-00001234");
  });

  it("pone las notas de crédito en negativo", () => {
    const fila = filaPlanilla({ ...datos, invoice: { ...invoice, tipo_comprobante: "nota_credito" } });
    expect(celda(fila, "Neto gravado")).toBe(-1000);
    expect(celda(fila, "Total")).toBe(-1210);
  });

  it("no deja que un texto de la factura se interprete como fórmula", () => {
    const fila = filaPlanilla({ ...datos, invoice: { ...invoice, razon_social: '=IMPORTXML("http://x")', concepto: "+1" } });
    expect(celda(fila, "Razón social")).toBe(`'=IMPORTXML("http://x")`);
    expect(celda(fila, "Concepto")).toBe("'+1");
  });

  it("la última columna es la clave", () => {
    expect(COLUMNAS.at(-1)!.titulo).toBe("Clave");
  });
});

describe("letraColumna", () => {
  it("convierte índices a letras", () => {
    expect([0, 25, 26, 30, 701, 702].map(letraColumna)).toEqual(["A", "Z", "AA", "AE", "ZZ", "AAA"]);
  });
});

describe("nombreArchivo", () => {
  it("arma el nombre estándar sin caracteres inválidos", () => {
    expect(nombreArchivo({ ...invoice, razon_social: "Corralón / Ejemplo: S.A." }, "application/pdf")).toBe(
      "2026-09-15 Corralón Ejemplo S.A. - Factura A 00003-00001234.pdf",
    );
    expect(nombreArchivo(invoice, "image/jpeg")).toMatch(/\.jpg$/);
  });
});
