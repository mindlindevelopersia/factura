import { describe, expect, it } from "vitest";
import type { Empresa } from "../empresa";
import { leerRegistros } from "../sheets/registros";
import { categoriaDe, completarFactura } from "./completar";
import type { Invoice } from "./schema";
import { claveDuplicado } from "./tipos";

const empresa: Empresa = {
  cuit: "30718811550",
  socios: [{ cuit: "20398016328", nombre: "Socio de prueba" }],
  corresponde_a: ["Lerma 439", "HQ"],
};

// Lo que leería la IA de la factura 74 de JH 94 Constructora.
const leida: Invoice = {
  fecha_factura: "2026-10-06",
  tipo_comprobante: "factura",
  letra: "A",
  codigo_arca: 1,
  punto_venta: 1,
  numero: 74,
  razon_social: "JH 94 CONSTRUCTORA S.R.L.",
  cuit: "30718277929",
  cuit_receptor: "30718811550",
  razon_social_receptor: "MINDLIN DEVELOPERS",
  concepto: "Trabajos realizados obra Lerma",
  moneda: "ARS",
  tipo_cambio: null,
  neto_gravado: 33938895.21,
  no_gravado: 0,
  iva_21: 0,
  iva_10_5: 3563584,
  iva_otras: 0,
  percepcion_iva: 0,
  percepcion_iibb_caba: 0,
  percepcion_iibb_pba: 0,
  otros_tributos: 0,
  total: 37502479.21,
  cae: null,
  cae_vencimiento: null,
  rubro: "Materiales",
  corresponde_a: "HQ",
  campos_dudosos: [],
  observaciones: null,
};

// Filas como las devuelve la API de Sheets: egresos C:I e ingresos C:H, desde la fila 2.
const egresos = [
  ["Factura A", "00001-00000072", "JH 94 CONSTRUCTORA S.R.L.", "Servicios de Terceros", "30-71827792-9", "2da certificación Agosto", "Lerma 439"],
  ["Factura C", "00001-00000045", "DRUCK MICAELA", "Monotributista", "27-37423564-3", "Honorarios Arq Druck", "HQ"],
  ["Nota de Crédito ", "00001-00000005", "JH 94 CONSTRUCTORA S.R.L.", "Servicios de Terceros", "30-71827792-9", "2da certificación Septiembre", "Lerma 439"],
  ["Factura C", "00001-00000046", "DRUCK MICAELA", "Monotributista", "27-37423564-3", "Honorarios Arq Druck", "HQ"],
  ["Factura A", "00010-00043702", "ONETO TOMAS AUGUSTO"], // sin CUIT: no cuenta
];
const ingresos = [
  ["Factura A", "00002-00000005", "MARTÍN MIRANDA", "Amortización", "30-71827792-9", "1 A"],
];

describe("leerRegistros", () => {
  const { historial, claves } = leerRegistros(egresos, ingresos);

  it("arma las claves de duplicado de lo cargado a mano", () => {
    expect(claves).toEqual(
      new Set([
        "E|30718277929|FC|1|72",
        "E|27374235643|FC|1|45",
        "E|30718277929|NC|1|5",
        "E|27374235643|FC|1|46",
        "I|FC|2|5",
      ]),
    );
  });

  it("guarda el número de fila de cada carga", () => {
    expect(historial.egresos.map((e) => e.fila)).toEqual([2, 3, 4, 5]);
    expect(historial.ingresos[0]).toMatchObject({ fila: 2, cliente: "MARTÍN MIRANDA", depto: "1 A" });
  });
});

describe("categoriaDe", () => {
  it("clasifica por el CUIT del emisor", () => {
    expect(categoriaDe({ cuit: "30718277929" }, empresa)).toBe("compra");
    expect(categoriaDe({ cuit: "30-71881155-0" }, empresa)).toBe("venta");
    expect(categoriaDe({ cuit: "20398016328" }, empresa)).toBe("honorarios");
    expect(categoriaDe({ cuit: null }, empresa)).toBe("compra");
  });
});

describe("completarFactura", () => {
  const { historial, claves } = leerRegistros(egresos, ingresos);

  it("toma razón social, rubro y corresponde a de la última carga del proveedor", () => {
    const { factura, desde } = completarFactura(leida, historial, empresa);
    expect(factura).toMatchObject({ categoria: "compra", rubro: "Servicios de Terceros", corresponde_a: "Lerma 439" });
    expect(desde).toEqual({ pestania: "egresos", fila: 4 });
  });

  it("deja el concepto de la IA si las últimas cargas no lo repiten", () => {
    expect(completarFactura(leida, historial, empresa).factura.concepto).toBe("Trabajos realizados obra Lerma");
  });

  it("usa el concepto de la planilla si las dos últimas cargas lo repiten", () => {
    const druck = { ...leida, cuit: "27374235643", razon_social: "Druck Micaela", numero: 47, concepto: "Honorarios profesionales" };
    expect(completarFactura(druck, historial, empresa).factura).toMatchObject({
      razon_social: "DRUCK MICAELA",
      concepto: "Honorarios Arq Druck",
      rubro: "Monotributista",
      corresponde_a: "HQ",
    });
  });

  it("sin carga anterior deja lo que propuso la IA", () => {
    const { factura, desde } = completarFactura({ ...leida, cuit: "30716418150" }, historial, empresa);
    expect(factura).toMatchObject({ rubro: "Materiales", corresponde_a: "HQ" });
    expect(desde).toBeNull();
    expect(completarFactura(leida, null, empresa).factura.rubro).toBe("Materiales");
  });

  it("en una venta propone cliente, tipo de pago y depto del mismo receptor", () => {
    const venta = { ...leida, cuit: "30718811550", cuit_receptor: "30718277929", razon_social_receptor: "JH 94 CONSTRUCTORA S.R.L.", punto_venta: 2, numero: 6 };
    const { factura, desde } = completarFactura(venta, historial, empresa);
    expect(factura).toMatchObject({ categoria: "venta", cliente: "MARTÍN MIRANDA", tipo_pago: "Amortización", depto: "1 A" });
    expect(desde).toEqual({ pestania: "ingresos", fila: 2 });
    expect(completarFactura(venta, null, empresa).factura).toMatchObject({ cliente: "JH 94 CONSTRUCTORA S.R.L.", tipo_pago: null });
  });

  it("encuentra como duplicada una factura cargada a mano", () => {
    const repetida = completarFactura({ ...leida, numero: 72 }, historial, empresa).factura;
    expect(claves.has(claveDuplicado(repetida)!)).toBe(true);
    // La NC 5 está cargada, pero la factura 5 no: se numeran por separado.
    const fc5 = completarFactura({ ...leida, numero: 5 }, historial, empresa).factura;
    expect(claves.has(claveDuplicado(fc5)!)).toBe(false);
    const venta5 = completarFactura({ ...leida, cuit: "30718811550", punto_venta: 2, numero: 5 }, historial, empresa).factura;
    expect(claves.has(claveDuplicado(venta5)!)).toBe(true);
  });
});
