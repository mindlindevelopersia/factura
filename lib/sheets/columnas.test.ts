import { describe, expect, it } from "vitest";
import { facturaDePrueba, ventaDePrueba } from "../../test/fixtures";
import { nombreArchivo, subcarpetaDe } from "../storage/archivos";
import { COLUMNAS_EGRESOS, COLUMNAS_INGRESOS, filaConOpcionales, filaPlanilla, importesSinColumna, letraColumna, type Celda } from "./columnas";

const compra = facturaDePrueba();
const venta = ventaDePrueba();

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
      "Razón Social": "Corralón Ejemplo S.A.",
      "Rubro / Descripción": "Materiales",
      CUIT: "33-69345023-9",
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
      "Cliente / Inversor / Razón Social": "INVERSOR EJEMPLO",
      "Tipo de Pago": "Amortización",
      "CUIT Receptor": "30-71234567-1",
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
    expect(fila["Cliente / Inversor / Razón Social"]).toBe("Constructora Ejemplo S.R.L.");
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
    expect(nombreArchivo({ ...compra, razon_social: "Corralón / Ejemplo: S.A." }, "application/pdf")).toBe(
      "2026-10-01 Corralón Ejemplo S.A. - Factura A 00005-00025853.pdf",
    );
    expect(nombreArchivo(compra, "image/jpeg")).toMatch(/\.jpg$/);
  });
  it("en las ventas usa el cliente", () => {
    expect(nombreArchivo(venta, "application/pdf")).toBe("2026-10-06 INVERSOR EJEMPLO - Factura A 00002-00000006.pdf");
  });
});

describe("subcarpetaDe", () => {
  it("arma la subcarpeta del mes de la factura, por categoría", () => {
    expect(subcarpetaDe(compra)).toBe("Facturas Compras Octubre 2026");
    expect(subcarpetaDe({ categoria: "honorarios", fecha_factura: "2026-01-31" })).toBe("Facturas Honorarios Enero 2026");
    expect(subcarpetaDe(venta)).toBe("Facturas Ventas Octubre 2026");
    expect(subcarpetaDe({ categoria: "compra", fecha_factura: "" })).toBe("Facturas Compras Sin fecha");
  });
});

describe("filaConOpcionales", () => {
  const titulos = COLUMNAS_EGRESOS.map((c) => c.titulo);
  it("sin columnas extra, es la fila de siempre", () => {
    expect(filaConOpcionales({ ...datos, factura: compra }, titulos)).toEqual(filaPlanilla({ ...datos, factura: compra }));
  });
  it("completa el rubro detallado si la pestaña tiene esa columna, donde esté", () => {
    const fila = filaConOpcionales({ ...datos, factura: compra }, [...titulos, "Notas", "rubro  DETALLADO"]);
    expect(fila).toHaveLength(27);
    expect(fila[25]).toBeNull();
    expect(fila[26]).toBe("Materiales de construcción");
  });
  it("no la busca entre las columnas fijas", () => {
    const fila = filaConOpcionales({ ...datos, factura: compra }, ["Rubro detallado", ...titulos.slice(1)]);
    expect(fila).toHaveLength(25);
  });
});
