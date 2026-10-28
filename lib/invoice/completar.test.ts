import { describe, expect, it } from "vitest";
import { ARQUITECTA, CONSTRUCTORA, CORRALON, CUIT_MINDLIN, invoiceDePrueba, SOCIO } from "../../test/fixtures";
import type { Empresa } from "../empresa";
import { buscarCargada, leerRegistros } from "../sheets/registros";
import { categoriaDe, completarFactura, esConceptoDePeriodo } from "./completar";
import { rubroDetalleDe } from "./proveedores";

const empresa: Empresa = {
  cuit: CUIT_MINDLIN,
  socios: [{ cuit: SOCIO.cuit, nombre: SOCIO.razon_social }],
  corresponde_a: ["Lerma 439", "HQ"],
};

// Lo que leería la IA de una certificación de la constructora.
const leida = invoiceDePrueba({
  fecha_factura: "2026-10-06",
  punto_venta: 1,
  numero: 74,
  razon_social: CONSTRUCTORA.razon_social.toUpperCase(),
  cuit: CONSTRUCTORA.cuit,
  concepto: "Trabajos realizados obra Lerma",
  neto_gravado: 33938895.21,
  iva_21: 0,
  iva_10_5: 3563584,
  total: 37502479.21,
  rubro: "Materiales",
  rubro_detalle: null,
  corresponde_a: "HQ",
});

const conGuiones = (c: string) => `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`;

// Filas como las devuelve la API de Sheets: egresos C:I e ingresos C:H, desde la fila 2.
const egresos = [
  ["Factura A", "00001-00000072", "Constructora Ejemplo S.R.L.", "Servicios de Terceros", conGuiones(CONSTRUCTORA.cuit), "2da certificación Agosto", "Lerma 439"],
  ["Factura C", "00001-00000045", "PEREZ ANA", "Monotributista", conGuiones(ARQUITECTA.cuit), "Honorarios Arq Pérez", "HQ"],
  ["Nota de Crédito ", "00001-00000005", "Constructora Ejemplo S.R.L.", "Servicios de Terceros", conGuiones(CONSTRUCTORA.cuit), "2da certificación Septiembre", "Lerma 439"],
  ["Factura C", "00001-00000046", "PEREZ ANA", "Monotributista", conGuiones(ARQUITECTA.cuit), "Honorarios Arq Pérez", "HQ"],
  ["Factura A", "00010-00043702", "PROVEEDOR SIN CUIT"], // sin CUIT: no cuenta
  ["Factura C", "00001-00000047", "PEREZ ANA", "Monotributista", conGuiones(ARQUITECTA.cuit), "Honorarios Arq Pérez", "HQ"],
];
const ingresos = [["Factura A", "00002-00000005", "INVERSOR EJEMPLO", "Amortización", conGuiones(CONSTRUCTORA.cuit), "1 A"]];

describe("leerRegistros", () => {
  const { historial, cargadas } = leerRegistros(egresos, ingresos);

  it("arma las claves de duplicado de lo cargado a mano", () => {
    expect([...cargadas.keys()]).toEqual([
      `E|${CONSTRUCTORA.cuit}|FC|1|72`,
      `E|${ARQUITECTA.cuit}|FC|1|45`,
      `E|${CONSTRUCTORA.cuit}|NC|1|5`,
      `E|${ARQUITECTA.cuit}|FC|1|46`,
      `E|${ARQUITECTA.cuit}|FC|1|47`,
      "I|FC|2|5",
    ]);
  });

  it("guarda el número de fila de cada carga", () => {
    expect(historial.egresos.map((e) => e.fila)).toEqual([2, 3, 4, 5, 7]);
    expect(historial.ingresos[0]).toMatchObject({ fila: 2, cliente: "INVERSOR EJEMPLO", depto: "1 A" });
  });
});

describe("categoriaDe", () => {
  it("clasifica por el CUIT del emisor", () => {
    expect(categoriaDe({ cuit: CONSTRUCTORA.cuit }, empresa)).toBe("compra");
    expect(categoriaDe({ cuit: "30-71881155-0" }, empresa)).toBe("venta");
    expect(categoriaDe({ cuit: SOCIO.cuit }, empresa)).toBe("honorarios");
    expect(categoriaDe({ cuit: null }, empresa)).toBe("compra");
  });
});

describe("completarFactura", () => {
  const registros = leerRegistros(egresos, ingresos);
  const { historial } = registros;

  it("toma razón social, rubro y corresponde a de la última carga del proveedor", () => {
    const { factura, desde } = completarFactura(leida, historial, empresa);
    expect(factura).toMatchObject({
      categoria: "compra",
      razon_social: "Constructora Ejemplo S.R.L.",
      rubro: "Servicios de Terceros",
      corresponde_a: "Lerma 439",
    });
    expect(desde).toEqual({ pestania: "egresos", fila: 4 });
  });

  it("deja el concepto de la IA si las últimas cargas no lo repiten", () => {
    expect(completarFactura(leida, historial, empresa).factura.concepto).toBe("Trabajos realizados obra Lerma");
  });

  it("usa el concepto de la planilla si las tres últimas cargas lo repiten", () => {
    const arquitecta = { ...leida, cuit: ARQUITECTA.cuit, razon_social: "Perez Ana", numero: 48, concepto: "Honorarios profesionales" };
    expect(completarFactura(arquitecta, historial, empresa).factura).toMatchObject({
      razon_social: "PEREZ ANA",
      concepto: "Honorarios Arq Pérez",
      rubro: "Monotributista",
      corresponde_a: "HQ",
    });
  });

  it("no repite el concepto de una certificación: cambia de período", () => {
    // Las dos últimas cargas de la constructora dicen "2da certificación ..." (filas 2 y 4, con la NC).
    const certificaciones = leerRegistros(
      [egresos[2], ["Factura A", "00001-00000075", "Constructora Ejemplo S.R.L.", "Servicios de Terceros", conGuiones(CONSTRUCTORA.cuit), "2da certificación Septiembre", "Lerma 439"]],
      [],
    );
    const octubre = { ...leida, numero: 77, concepto: "1ra certificación Octubre" };
    expect(completarFactura(octubre, certificaciones.historial, empresa).factura.concepto).toBe("1ra certificación Octubre");
  });

  it("reconoce los conceptos de un período", () => {
    for (const c of ["2da certificación Septiembre", "Certificación 16", "Cuota 12", "Anticipo obra", "Honorarios octubre", "1ra quincena"]) {
      expect(esConceptoDePeriodo(c), c).toBe(true);
    }
    for (const c of ["Serv de Seguridad e Higiene", "Honorarios Contador", "WIFI Lerma", "Hormigón H-30", "Licencia LEBANE", "Honorarios CEO"]) {
      expect(esConceptoDePeriodo(c), c).toBe(false);
    }
  });

  it("sin carga anterior deja lo que propuso la IA", () => {
    const { factura, desde } = completarFactura({ ...leida, cuit: CORRALON.cuit }, historial, empresa);
    expect(factura).toMatchObject({ rubro: "Materiales", corresponde_a: "HQ" });
    expect(desde).toBeNull();
    expect(completarFactura(leida, null, empresa).factura.rubro).toBe("Materiales");
  });

  it("los honorarios de un socio también se completan con su carga anterior", () => {
    const { factura } = completarFactura({ ...leida, cuit: SOCIO.cuit, razon_social: SOCIO.razon_social }, historial, empresa);
    expect(factura.categoria).toBe("honorarios");
  });

  it("en una venta propone cliente, tipo de pago y depto del mismo receptor", () => {
    const venta = { ...leida, cuit: CUIT_MINDLIN, cuit_receptor: CONSTRUCTORA.cuit, razon_social_receptor: CONSTRUCTORA.razon_social, punto_venta: 2, numero: 6 };
    const { factura, desde } = completarFactura(venta, historial, empresa);
    expect(factura).toMatchObject({ categoria: "venta", cliente: "INVERSOR EJEMPLO", tipo_pago: "Amortización", depto: "1 A" });
    expect(desde).toEqual({ pestania: "ingresos", fila: 2 });
    expect(completarFactura(venta, null, empresa).factura).toMatchObject({ cliente: CONSTRUCTORA.razon_social, tipo_pago: null });
  });

  it("encuentra como duplicada una factura cargada a mano", () => {
    const repetida = completarFactura({ ...leida, numero: 72 }, historial, empresa).factura;
    expect(buscarCargada(registros, repetida)).toEqual({ tipo: "duplicada", fila: 2 });
    // La NC 5 está cargada, pero la factura 5 no: se numeran por separado.
    const fc5 = completarFactura({ ...leida, numero: 5 }, historial, empresa).factura;
    expect(buscarCargada(registros, fc5)).toBeNull();
    const venta5 = completarFactura({ ...leida, cuit: CUIT_MINDLIN, punto_venta: 2, numero: 5 }, historial, empresa).factura;
    expect(buscarCargada(registros, venta5)?.tipo).toBe("duplicada");
  });

  it("mismo número con otro total: avisa pero no es duplicada", () => {
    // Columnas C a T: el total va en la 18.
    const fila = (n: string, total: number) => ["Liquidación A", n, "BANCO EJEMPLO", "", conGuiones(CORRALON.cuit), "Comisiones", "HQ", ...Array(10).fill(""), total];
    const banco = leerRegistros([fila("00005-00165220", 309500.4)], []);
    const misma = completarFactura({ ...leida, cuit: CORRALON.cuit, tipo_comprobante: "liquidacion", punto_venta: 5, numero: 165220, total: 309500.4 }, null, empresa).factura;
    expect(buscarCargada(banco, misma)).toEqual({ tipo: "duplicada", fila: 2 });
    expect(buscarCargada(banco, { ...misma, total: 309500.9 })?.tipo).toBe("duplicada");
    expect(buscarCargada(banco, { ...misma, total: 205596.6 })).toEqual({ tipo: "mismo_numero", fila: 2 });
    expect(buscarCargada(null, misma)).toBeNull();
  });

  it("no propone el concepto de un proveedor de materiales: cada compra trae otra cosa", () => {
    const fila = (n: number) => ["Factura A", `00005-${n}`, "Corralón Ejemplo S.A.", "Materiales", conGuiones(CORRALON.cuit), "Cemento", "Lerma 439"];
    const corralon = leerRegistros([fila(1), fila(2), fila(3)], []);
    const placas = { ...leida, cuit: CORRALON.cuit, numero: 4, concepto: "Placas y cerecita" };
    expect(completarFactura(placas, corralon.historial, empresa).factura.concepto).toBe("Placas y cerecita");
  });
});

describe("rubroDetalleDe", () => {
  const lista = [
    { razon_social: "CORRALON EJEMPLO S.A.", rubro_detalle: "Materiales de construcción" },
    { razon_social: "FUMIGACIONES EJEMPLO", rubro_detalle: "Fumigación y plagas" },
  ];
  it("busca por razón social sin importar acentos, puntuación ni tipo societario", () => {
    expect(rubroDetalleDe("Corralón Ejemplo SA", lista)).toBe("Materiales de construcción");
    expect(rubroDetalleDe("FUMIGACIONES EJEMPLO - Otro Nombre", lista)).toBe("Fumigación y plagas");
    expect(rubroDetalleDe("Otro proveedor", lista)).toBeNull();
    expect(rubroDetalleDe(null, lista)).toBeNull();
  });
  it("la lista del cliente tiene los 62 proveedores", async () => {
    const { PROVEEDORES, RUBROS_DETALLE } = await import("./proveedores");
    expect(PROVEEDORES).toHaveLength(62);
    expect(RUBROS_DETALLE).toContain("Materiales de construcción");
  });
});
