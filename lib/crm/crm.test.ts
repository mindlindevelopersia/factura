import { describe, expect, it } from "vitest";
import type { Celda } from "../finanzas/ingresos";
import { alarmasDe, tablero, temperaturaSugerida, unidadesPara, type UnidadDisponible } from "./alarmas";
import { etapaDePlanilla, importarCrm } from "./importar";
import { linkWhatsapp, mensajeSugerido } from "./mensajes";
import { aplicarCambios, contactoDeFila, filaDeContacto, validarContacto, type Contacto } from "./modelo";

const AHORA = "2026-11-10T15:00:00.000Z"; // 12 h en Buenos Aires
const HOY = "2026-11-10";
const contacto = (x: Partial<Contacto> = {}): Contacto => ({
  id: "c1",
  proyectos: ["lerma-439"],
  nombre: "Juana Pérez",
  telefono: "11 5555-1234",
  mail: "juana@x.com",
  tipo: "Beneficiario al costo",
  origen: "Referido",
  referido: "Pallini",
  etapa: "Interesado",
  temperaturaManual: null,
  presupuestoUsd: 100000,
  formaPago: "Al costo (cuotas)",
  plazo: "2 a 6 meses",
  uso: "Invertir",
  ambientes: "2 ambientes",
  unidades: [],
  proximoPaso: "Mandarle la propuesta",
  proximaFecha: "2026-11-12",
  motivoPerdida: "",
  volverAContactar: null,
  notas: "",
  responsable: "Mati",
  creado: "2026-11-01T12:00:00.000Z",
  actualizado: "2026-11-08T12:00:00.000Z",
  entroEtapa: "2026-11-05T12:00:00.000Z",
  ultimoContacto: "2026-11-08T12:00:00.000Z",
  unidadVendida: "",
  precioVentaUsd: null,
  ...x,
});

const UNIDADES: UnidadDisponible[] = [
  { codigo: "2C", tipologia: "2 ambientes", orientacion: "Contrafrente", m2: 42.9, precioUsd: 113286, tipo: "libre" },
  { codigo: "1C", tipologia: "2 ambientes", orientacion: "Contrafrente", m2: 42.9, precioUsd: 111612, tipo: "libre" },
  { codigo: "1B", tipologia: "Monoambiente", orientacion: "Frente", m2: 35.2, precioUsd: 91528, tipo: "libre" },
  { codigo: "1A", tipologia: "2 ambientes", orientacion: "Frente", m2: 47.1, precioUsd: 105000, tipo: "reventa" },
];

describe("CRM: modelo", () => {
  it("las etapas viejas (Evaluando, Negociando) pasan a Propuesta enviada", () => {
    for (const vieja of ["Evaluando", "Negociando"]) {
      const f = filaDeContacto(contacto());
      f[8] = vieja;
      expect(contactoDeFila(f).etapa).toBe("Propuesta enviada");
    }
  });

  it("una fila de la planilla y un contacto van y vuelven iguales", () => {
    const c = contacto({ unidades: ["2C", "1A"], temperaturaManual: "hot" });
    expect(contactoDeFila(filaDeContacto(c))).toEqual(c);
  });

  it("valida y al cambiar de etapa guarda cuándo entró; cerrar borra el próximo paso", () => {
    expect(validarContacto({ nombre: "" }, true)).toBe("Falta el nombre.");
    expect(validarContacto({ proximaFecha: "10/11" }, false)).toBe("Fecha inválida.");
    const c = aplicarCambios(contacto(), { etapa: "Propuesta enviada" }, AHORA);
    expect(c.entroEtapa).toBe(AHORA);
    const v = aplicarCambios(contacto(), { etapa: "Vendido" }, AHORA);
    expect(v).toMatchObject({ proximoPaso: "", proximaFecha: null });
  });
});

describe("CRM: temperatura y alarmas", () => {
  it("hot si tiene propuesta y hablamos hace poco; frío si hace más de 14 días o no le alcanza", () => {
    expect(temperaturaSugerida(contacto({ etapa: "Propuesta enviada" }), HOY)).toBe("hot");
    expect(temperaturaSugerida(contacto({ ultimoContacto: "2026-10-20T12:00:00.000Z" }), HOY)).toBe("frio");
    expect(temperaturaSugerida(contacto({ presupuestoUsd: 60000 }), HOY, 91528)).toBe("frio");
    expect(temperaturaSugerida(contacto(), HOY)).toBe("tibio");
    expect(temperaturaSugerida(contacto({ etapa: "Vendido" }), HOY)).toBe(null);
  });

  it("dice a quién hablarle: nuevo sin contactar, seguimiento vencido o de hoy, propuesta por vencer", () => {
    const tipos = (c: Contacto) => alarmasDe(c, AHORA).map((a) => a.tipo);
    expect(tipos(contacto({ etapa: "Nuevo", ultimoContacto: null, proximaFecha: null, creado: "2026-11-10T10:00:00.000Z" }))).toEqual(["nuevo"]);
    expect(alarmasDe(contacto({ proximaFecha: "2026-11-07" }), AHORA)[0].texto).toBe("Hablale a Juana: Mandarle la propuesta era el 07/11 (hace 3 días).");
    expect(tipos(contacto({ proximaFecha: HOY }))).toEqual(["hoy"]);
    expect(tipos(contacto({ etapa: "Propuesta enviada", entroEtapa: "2026-11-04T12:00:00.000Z" }))).toContain("propuesta");
    expect(tipos(contacto({ proximaFecha: null }))).toContain("sin-paso");
    expect(tipos(contacto({ etapa: "Perdido", volverAContactar: "2026-11-01", motivoPerdida: "Precio" }))).toEqual(["recontactar"]);
    expect(tipos(contacto({ temperaturaManual: "hot", ultimoContacto: "2026-11-05T12:00:00.000Z" }))).toContain("hot");
  });

  it("el tablero cuenta etapas, seguimientos, conversión y orígenes", () => {
    const t = tablero(
      [contacto(), contacto({ id: "2", proximaFecha: "2026-11-01" }), contacto({ id: "3", etapa: "Vendido", origen: "Pauta" }), contacto({ id: "4", etapa: "Perdido", motivoPerdida: "Precio" })],
      [{ fecha: "2026-11-09T12:00:00.000Z", usuario: "Mati", contactoId: "c1", contacto: "", tipo: "Llamada", detalle: "", etapa: "" }],
      AHORA,
    );
    expect(t).toMatchObject({ total: 4, abiertos: 2, conversion: 0.5, seguimientos: { vencidos: 1, hoy: 0, semana: 1 } });
    expect(t.motivosPerdida).toEqual([{ motivo: "Precio", total: 1 }]);
    expect(t.actividadSemana).toEqual([{ usuario: "Mati", total: 1 }]);
  });
});

describe("CRM: cruce con la Lista de precios", () => {
  const estados = [
    { codigo: "2C", estado: "libre" as const, inversor: "", reventa: false },
    { codigo: "5B", estado: "vendida" as const, inversor: "Pablo Pallini", reventa: false },
    { codigo: "1A", estado: "vendida" as const, inversor: "Miranda", reventa: true },
  ];
  it("avisa si en el CRM se vendió y la lista sigue libre, y si se vendió la unidad que le interesaba a alguien", () => {
    const vendido = alarmasDe(contacto({ etapa: "Vendido", unidadVendida: "2C", proximaFecha: null }), AHORA, null, estados);
    expect(vendido.map((a) => a.texto)).toEqual(["Actualizá la planilla: en el CRM la 2C está vendida a Juana Pérez, pero en la Lista de precios sigue libre."]);
    const interesada = alarmasDe(contacto({ unidades: ["5B", "1A"] }), AHORA, null, estados);
    expect(interesada.filter((a) => a.tipo === "vendida").map((a) => a.texto)).toEqual(["La 5B se vendió (a Pablo Pallini): ofrecele otra a Juana."]);
  });
});

describe("CRM: unidades y mensajes", () => {
  it("sugiere las que entran en el presupuesto (hasta 5% más) y con los ambientes que busca", () => {
    expect(unidadesPara(contacto(), UNIDADES).map((u) => u.codigo)).toEqual(["1A"]);
    expect(unidadesPara(contacto({ presupuestoUsd: 120000 }), UNIDADES).map((u) => u.codigo)).toEqual(["2C", "1C", "1A"]);
    expect(unidadesPara(contacto({ ambientes: "Monoambiente" }), UNIDADES).map((u) => u.codigo)).toEqual(["1B"]);
  });

  it("arma el mensaje de la etapa con su nombre y la unidad, y el link de WhatsApp", () => {
    const m = mensajeSugerido(contacto(), unidadesPara(contacto(), UNIDADES), "Lerma 439", "Mati");
    expect(m.whatsapp).toMatch(/^Hola Juana! Con lo que me contaste, la que mejor te sirve es la 1A/);
    expect(m.mail).toMatch(/Saludos,\nMati\nMindlin Developers$/);
    expect(linkWhatsapp("11 5555-1234", "Hola", () => "5491155551234")).toBe("https://wa.me/5491155551234?text=Hola");
    expect(linkWhatsapp("", "Hola", () => null)).toBe(null);
  });
});

describe("CRM: importar del Excel madre", () => {
  const f = (...v: Celda["valor"][]): Celda[] => v.map((valor) => ({ valor, color: null }));
  it("pasa las etapas y orígenes de la planilla, sin repetir y sin seguimientos viejos", () => {
    expect(etapaDePlanilla("Churn ")).toEqual({ etapa: "Perdido", temperatura: null });
    expect(etapaDePlanilla("Hot")).toEqual({ etapa: "Interesado", temperatura: "hot" });
    const filas = [
      f("Nombre y apellido ", "Mail", "Type", "Stage", "Last contacted", "Next date FU", "Source", "Situación"),
      f("Ana Gómez", "ana@x.com", "Beneficiario al costo", "Follow up", 46315, 46330, "Nico Meschiany", "Quiere 2 amb"),
      f("Viejo Seguimiento", "", "", "Follow up", 45000, null, "", ""),
      f("Beto Ruiz", "", "Inversor tierra", "Sold", null, null, "Mati Mindlin", "Confirmado"),
      f("Juana Pérez", "", "", "Contactado", null, null, "LinkedIn", ""),
    ];
    const r = importarCrm(filas, [{ nombre: "Juana  Perez" }], "lerma-439", AHORA, HOY);
    expect(r.map((c) => [c.nombre, c.etapa, c.origen, c.referido])).toEqual([
      ["Ana Gómez", "Interesado", "Referido", "Nico Meschiany"],
      ["Viejo Seguimiento", "Dormido", "", ""],
      ["Beto Ruiz", "Vendido", "Base propia", ""],
    ]);
    expect(r[0]).toMatchObject({ proximaFecha: "2026-11-04", ultimoContacto: "2026-10-20T12:00:00.000Z", notas: "Quiere 2 amb" });
    expect(r[1].notas).toMatch(/Importado como dormido/);
    expect(r[2].notas).toBe("");
  });
});

import { claveTelefono, detectarColumnas, importarBase } from "./importarBase";
describe("CRM: importar una base de contactos", () => {
  const f = (...v: Celda["valor"][]): Celda[] => v.map((valor) => ({ valor, color: null }));
  const FILAS = [
    f("Base de inversores 2026"),
    f("Nombre", "Apellido", "E-mail", "Celular", "Empresa", "Comentarios"),
    f("Ana", "Gómez", "ANA@x.com", "+54 9 11 5555-1111", "Gómez SA", "Le interesa invertir"),
    f("Ana", "Gómez", "ana@x.com", "", "", ""),
    f("Juana", "Pérez", "", "011 15 5555-1234", "", ""),
    f("Pedro", "Ríos", "pedro@x.com", "", "", ""),
    f("", "", "sin@nombre.com", "", "", ""),
  ];
  it("como la planilla de Mati: referencia como referido, el resto a las notas, sin #ERROR!", () => {
    const filas = [
      f("Apellido", "NOMBRE", "OCUPACION + REFERENCIA", "Categoría de inversor", "Referencia - Fuente", "TELEFONO", "Contacto por Mati", "Respuesta?"),
      f("", "Persona Inventada", "Dueño de depto", "Cat B (+ USD 50.000)", "Un Referido", "\u202d+54 9 11 0000 0001\u202c", "SI", "Le interesa"),
      f("", "Otra Inventada", "", "", "", "#ERROR!", "NO", ""),
    ];
    const r = importarBase(filas, [], AHORA);
    expect(r.nuevos.map((c) => [c.nombre, c.referido, c.telefono, c.notas])).toEqual([
      ["Persona Inventada", "Un Referido", "+54 9 11 0000 0001", "OCUPACION + REFERENCIA: Dueño de depto · Categoría de inversor: Cat B (+ USD 50.000) · Contacto por Mati: SI · Respuesta: Le interesa"],
      ["Otra Inventada", "", "", ""],
    ]);
  });

  it("reconoce las columnas por el título", () => {
    expect(detectarColumnas(FILAS)?.campos).toEqual({ nombre: 0, apellido: 1, mail: 2, telefono: 3, empresa: 4, notas: 5 });
    expect(claveTelefono("+54 9 11 5555-1234")).toBe(claveTelefono("011 15 5555-1234"));
  });
  it("saca duplicados (en la planilla y contra el CRM) y completa lo que falta", () => {
    const existentes = [{ ...contacto(), telefono: "", mail: "" }, { ...contacto({ id: "c2", nombre: "Otra", mail: "pedro@x.com", telefono: "" }) }];
    const r = importarBase(FILAS, existentes, AHORA);
    expect(r.nuevos.map((c) => [c.nombre, c.etapa, c.origen, c.notas])).toEqual([["Ana Gómez", "Dormido", "Base de inversores", "Empresa: Gómez SA. · Le interesa invertir"]]);
    expect(r.repetidosEnPlanilla).toBe(1);
    expect(r.yaEstaban).toEqual([
      { nombre: "Juana Pérez", existente: "Juana Pérez", por: "nombre" },
      { nombre: "Pedro Ríos", existente: "Otra", por: "mail" },
    ]);
    expect(r.completar).toEqual([{ id: "c1", nombre: "Juana Pérez", telefono: "011 15 5555-1234" }]);
    expect(r.sinNombre).toBe(1);
  });
});
