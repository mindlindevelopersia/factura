import { describe, expect, it } from "vitest";
import type { Invoice } from "../invoice/schema";
import { claveDuplicado, codigoArca, formatTipo } from "../invoice/tipos";
import { checkSum, compareWithQr, isValidCuit, parseArcaQr, validateInvoice } from "./index";

const factura: Invoice = {
  fecha_factura: "2026-09-15",
  tipo_comprobante: "factura",
  letra: "A",
  codigo_arca: null,
  punto_venta: 3,
  numero: 1234,
  razon_social: "Corralón Ejemplo S.A.",
  cuit: "33693450239",
  cuit_receptor: "20123456786",
  concepto: "Cemento y arena",
  moneda: "ARS",
  tipo_cambio: null,
  neto_gravado: 1000,
  no_gravado: 0,
  iva_21: 210,
  iva_10_5: 0,
  iva_otras: 0,
  percepcion_iva: 30,
  percepcion_iibb_caba: 0,
  percepcion_iibb_pba: 25.5,
  otros_tributos: 0,
  total: 1265.5,
  cae: "75123456789012",
  cae_vencimiento: "2026-09-25",
  rubro: "Materiales",
  proyecto: "Lerma",
  campos_dudosos: [],
  observaciones: null,
};

function qrUrl(data: object): string {
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(data)).toString("base64")}`;
}

const qrOk = {
  ver: 1,
  fecha: "2026-09-15",
  cuit: 33693450239,
  ptoVta: 3,
  tipoCmp: 1,
  nroCmp: 1234,
  importe: 1265.5,
  moneda: "PES",
  ctz: 1,
  tipoDocRec: 80,
  nroDocRec: 20123456786,
  tipoCodAut: "E",
  codAut: 75123456789012,
};

describe("CUIT", () => {
  it("acepta CUIT válidos, con o sin guiones", () => {
    expect(isValidCuit("33693450239")).toBe(true);
    expect(isValidCuit("20-12345678-6")).toBe(true);
  });
  it("rechaza dígito verificador, largo o prefijo incorrectos", () => {
    expect(isValidCuit("33693450238")).toBe(false);
    expect(isValidCuit("2012345678")).toBe(false);
    expect(isValidCuit("11123456786")).toBe(false);
  });
});

describe("suma", () => {
  it("cierra cuando los importes suman el total", () => {
    expect(checkSum(factura)).toEqual({ ok: true, suma: 1265.5, diferencia: 0 });
  });
  it("tolera diferencias de redondeo", () => {
    expect(checkSum({ ...factura, total: 1265.53 }).ok).toBe(true);
  });
  it("detecta cuando no cierra", () => {
    expect(checkSum({ ...factura, total: 1300 })).toEqual({ ok: false, suma: 1265.5, diferencia: 34.5 });
  });
});

describe("QR de ARCA", () => {
  it("decodifica la URL del QR", () => {
    expect(parseArcaQr(qrUrl(qrOk))).toMatchObject({ cuit: 33693450239, nroCmp: 1234 });
  });
  it("devuelve null si no es un QR de ARCA", () => {
    expect(parseArcaQr("https://example.com")).toBeNull();
    expect(parseArcaQr("no es una url")).toBeNull();
    expect(parseArcaQr("https://www.afip.gob.ar/fe/qr/?p=bm8gZXMganNvbg==")).toBeNull();
  });
  it("no encuentra diferencias cuando coincide", () => {
    expect(compareWithQr(factura, parseArcaQr(qrUrl(qrOk))!)).toEqual([]);
  });
  it("encuentra las diferencias", () => {
    const qr = parseArcaQr(qrUrl({ ...qrOk, nroCmp: 1243, importe: 1256.5, moneda: "DOL" }))!;
    expect(compareWithQr(factura, qr).map((d) => d.campo)).toEqual(["numero", "moneda", "total"]);
  });
});

describe("validateInvoice", () => {
  it("no marca nada en una factura correcta", () => {
    expect(validateInvoice(factura, { qr: qrUrl(qrOk) })).toEqual({ problemas: [], dudosos: [] });
  });
  it("suma los dudosos de la IA y los de los controles", () => {
    const v = validateInvoice({ ...factura, cuit: "33693450238", total: 1300, campos_dudosos: ["concepto"] });
    expect(v.problemas.map((p) => p.control)).toEqual(["cuit", "suma"]);
    expect(v.dudosos).toEqual(
      expect.arrayContaining(["concepto", "cuit", "total", "neto_gravado", "iva_21", "percepcion_iva", "percepcion_iibb_pba"]),
    );
  });
});

describe("tipos de comprobante", () => {
  it("deriva el código ARCA del tipo y la letra", () => {
    expect(codigoArca(factura)).toBe(1);
    expect(codigoArca({ ...factura, tipo_comprobante: "nota_credito", letra: "B" })).toBe(8);
    expect(codigoArca({ ...factura, codigo_arca: 201 })).toBe(201);
    expect(codigoArca({ ...factura, tipo_comprobante: "ticket", letra: null })).toBeNull();
  });
  it("arma la clave de duplicado", () => {
    expect(claveDuplicado(factura)).toBe("33693450239|1|00003-00001234");
    expect(claveDuplicado({ ...factura, numero: null })).toBeNull();
  });
  it("formatea el tipo para la planilla", () => {
    expect(formatTipo({ tipo_comprobante: "nota_credito", letra: "C" })).toBe("Nota de crédito C");
  });
});
