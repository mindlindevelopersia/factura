import { describe, expect, it } from "vitest";
import type { Factura } from "../invoice/schema";
import { nombreArchivo } from "../storage/archivos";
import { COLUMNAS_EGRESOS, COLUMNAS_INGRESOS, filaPlanilla, importesSinColumna, letraColumna, type Celda } from "./columnas";

// Como la fila 214 de la planilla: Costa Materiales, 1/10/2026.
const compra: Factura = {
  fecha_factura: "2026-10-01",
  tipo_comprobante: "factura",
  letra: "A",
  codigo_arca: 1,
  punto_venta: 5,
  numero: 25853,
  razon_social: "COSTA MATERIALES S.A.",
  cuit: "30716418150",
  cuit_receptor: "30718811550",
  razon_social_receptor: "MINDLIN DEVELOPERS SA",
  concepto: "Cemento",
  moneda: "ARS",
  tipo_cambio: null,
  neto_gravado: 37306.01,
  no_gravado: 0,
  iva_21: 7834.26,
  iva_10_5: 0,
  iva_otras: 0,
  percepcion_iva: 0,
  percepcion_iibb_caba: 0,
  percepcion_iibb_pba: 0,
  otros_tributos: 0,
  total: 45140.27,
  cae: "86405562470534",
  cae_vencimiento: "2026-10-11",
  rubro: "Materiales",
  corresponde_a: "Lerma 439",
  campos_dudosos: [],
  observaciones: null,
  categoria: "compra",
  cliente: null,
  tipo_pago: null,
  depto: null,
};

// Como la fila 7 de ventas: certificación 15, canje de la unidad 1-A.
const venta: Factura = {
  ...compra,
  fecha_factura: "2026-10-06",
  punto_venta: 2,
  numero: 6,
  razon_social: "MINDLIN DEVELOPERS",
  cuit: "30718811550",
  cuit_receptor: "30718277929",
  razon_social_receptor: "JH 94 CONSTRUCTORA S.R.L.",
  concepto: "Certificación 15",
  neto_gravado: 15169108.98,
  iva_21: 0,
  iva_10_5: 1592756.44,
  total: 16761865.42,
  rubro: null,
  corresponde_a: null,
  categoria: "venta",
  cliente: "MARTÍN MIRANDA",
  tipo_pago: "Amortización",
  depto: "1 A",
};

const datos = { fechaRegistro: "2026-10-01", link: "https://drive.google.com/x" };

/** La fila como objeto, por título de columna, para comparar sin depender de las posiciones. */
function porTitulo(fila: Celda[], columnas: { titulo: string }[]) {
  return Object.fromEntries(columnas.map((c, i) => [c.titulo, fila[i]]));
}

describe("filaPlanilla", () => {
  it("arma la fila de egresos como la carga el equipo, de la A a la Y", () => {
    const fila = filaPlanilla({ ...datos, factura: compra });
    expect(fila).toHaveLength(25);
    expect(letraColumna(fila.length - 1)).toBe("Y");
    expect(porTitulo(fila, COLUMNAS_EGRESOS)).toEqual({
      "Fecha de la Factura": "2026-10-01",
      "Fecha de Registro": "2026-10-01",
      "Tipo de Comprobante": "Factura A",
      "Nº Comprobante / Operación": "00005-00025853",
      "Razón Social": "COSTA MATERIALES S.A.",
      "Rubro / Descripción": "Materiales",
      CUIT: "30-71641815-0",
      Concepto: "Cemento",
      "Corresponde a": "Lerma 439",
      "Forma de Pago": null,
      "Banco del que Salió": null,
      Moneda: "Pesos",
      "Importe Neto Gravado": 37306.01,
      "Importe No Gravado": "",
      "IVA 21%": 7834.26,
      "IVA 10,5%": "",
      "Percepción IVA": "",
      "Percepción IIBB CABA": "",
      "Percepción IIBB Prov BSAS": "",
      "Importe Total": 45140.27,
      "Retención Impuesto a las Ganancias": null,
      "Monto a Transferir": null,
      "Comprobante Retención": null,
      Factura: "https://drive.google.com/x",
      "Pago?": null,
    });
  });

  it("los honorarios van a egresos como una compra", () => {
    const fila = filaPlanilla({ ...datos, factura: { ...compra, categoria: "honorarios" } });
    expect(fila).toHaveLength(COLUMNAS_EGRESOS.length);
  });

  it("arma la fila de ventas, de la A a la O", () => {
    const fila = filaPlanilla({ ...datos, factura: venta });
    expect(letraColumna(fila.length - 1)).toBe("O");
    expect(porTitulo(fila, COLUMNAS_INGRESOS)).toEqual({
      "Fecha Factura": "2026-10-06",
      "Fecha de Registro": "2026-10-01",
      Tipo: "Factura A",
      "Nº Comprobante": "00002-00000006",
      "Cliente / Inversor / Razón Social": "MARTÍN MIRANDA",
      "Tipo de Pago": "Amortización",
      "CUIT Receptor": "30-71827792-9",
      "Depto adquirido": "1 A",
      Moneda: "Pesos",
      Importe: 15169108.98,
      "IVA 10,5%": 1592756.44,
      "IVA 21%": "",
      "Importe Total": 16761865.42,
      Link: "https://drive.google.com/x",
      Comentario: "Certificación 15",
    });
  });

  it("sin cliente, en ventas va el receptor del comprobante", () => {
    const fila = porTitulo(filaPlanilla({ ...datos, factura: { ...venta, cliente: null } }), COLUMNAS_INGRESOS);
    expect(fila["Cliente / Inversor / Razón Social"]).toBe("JH 94 CONSTRUCTORA S.R.L.");
  });

  it("pone las notas de crédito en negativo y la moneda como en la planilla", () => {
    const nc = { ...compra, tipo_comprobante: "nota_credito" as const, moneda: "USD" as const };
    const fila = porTitulo(filaPlanilla({ ...datos, factura: nc }), COLUMNAS_EGRESOS);
    expect(fila["Tipo de Comprobante"]).toBe("Nota de Crédito A");
    expect(fila["Importe Neto Gravado"]).toBe(-37306.01);
    expect(fila["Importe Total"]).toBe(-45140.27);
    expect(fila.Moneda).toBe("Dólares");
  });

  it("no deja que un texto de la factura se interprete como fórmula", () => {
    const f = { ...compra, razon_social: '=IMPORTXML("http://x")', concepto: "+1" };
    const fila = porTitulo(filaPlanilla({ ...datos, factura: f }), COLUMNAS_EGRESOS);
    expect(fila["Razón Social"]).toBe(`'=IMPORTXML("http://x")`);
    expect(fila.Concepto).toBe("'+1");
  });
});

describe("importesSinColumna", () => {
  it("avisa de los importes que la pestaña no tiene", () => {
    expect(importesSinColumna(compra)).toEqual([]);
    expect(importesSinColumna({ ...compra, iva_otras: 10, percepcion_iva: 5 })).toEqual(["iva_otras"]);
    expect(importesSinColumna({ ...venta, percepcion_iva: 5 })).toEqual(["percepcion_iva"]);
  });
});

describe("letraColumna", () => {
  it("convierte índices a letras", () => {
    expect([0, 25, 26, 30, 701, 702].map(letraColumna)).toEqual(["A", "Z", "AA", "AE", "ZZ", "AAA"]);
  });
});

describe("nombreArchivo", () => {
  it("arma el nombre estándar sin caracteres inválidos", () => {
    expect(nombreArchivo({ ...compra, razon_social: "Costa / Materiales: S.A." }, "application/pdf")).toBe(
      "2026-10-01 Costa Materiales S.A. - Factura A 00005-00025853.pdf",
    );
    expect(nombreArchivo(compra, "image/jpeg")).toMatch(/\.jpg$/);
  });
  it("en las ventas usa el cliente", () => {
    expect(nombreArchivo(venta, "application/pdf")).toBe("2026-10-06 MARTÍN MIRANDA - Factura A 00002-00000006.pdf");
  });
});
