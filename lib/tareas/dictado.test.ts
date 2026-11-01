import { describe, expect, it } from "vitest";
import { sumarDictado } from "../../components/Dictado";
import { toOutputSchema } from "../invoice/json-schema";
import { aCambios, esquemaDictado, pedidoDictado, sinIa } from "./dictado";

const base = { titulo: "Llamar a la constructora", descripcion: "", responsable: "", vence: "", hora: "", prioridad: "Normal" as const, tipo: "Llamada" as const, relacion: "Interna" as const, con: "", subtareas: [] as string[] };

describe("tarea dictada", () => {
  it("el responsable solo puede ser alguien del equipo (o nadie)", () => {
    const e = esquemaDictado(["Mati", "Eliana"]);
    expect(e.safeParse({ ...base, responsable: "Eliana" }).success).toBe(true);
    expect(e.safeParse({ ...base, responsable: "Inventado" }).success).toBe(false);
    const json = JSON.stringify(toOutputSchema(e));
    expect(json).toContain('"enum":["","Mati","Eliana"]');
    expect(json).not.toContain("maxLength");
  });

  it("pasa por las reglas de una tarea: fechas y horas válidas, subtareas, relación", () => {
    const c = aCambios({ ...base, responsable: "Eliana", vence: "2026-11-03", hora: "10:30", prioridad: "Urgente", subtareas: ["pedir presupuesto", "  "], relacion: "Proveedor", con: "La constructora" });
    expect(c).toMatchObject({ titulo: "Llamar a la constructora", responsable: "Eliana", vence: "2026-11-03", hora: "10:30", prioridad: "Urgente", relacion: "Proveedor", con: "La constructora" });
    expect(c.subtareas).toEqual([{ texto: "pedir presupuesto", hecha: false }]);
    const mal = aCambios({ ...base, vence: "mañana", hora: "a la tarde", relacion: "Inversor" });
    expect(mal.vence).toBeNull();
    expect(mal.hora).toBe("");
    expect(mal.relacion).toBe("Interna");
  });

  it("el pedido lleva el día de hoy y el equipo", () => {
    expect(pedidoDictado("algo", "2026-11-01", ["Mati"])).toMatch(/^Hoy es domingo 2026-11-01\.\nEquipo: Mati\./);
  });

  it("sin IA: primera frase al título y todo a la descripción", () => {
    expect(sinIa("llamar a la constructora. Que lo haga Eliana")).toEqual({ titulo: "Llamar a la constructora.", descripcion: "llamar a la constructora. Que lo haga Eliana" });
    expect(sinIa("comprar hormigón")).toEqual({ titulo: "Comprar hormigón", descripcion: "" });
  });

  it("lo dictado se suma a lo escrito", () => {
    expect(sumarDictado("", "hola qué tal")).toBe("Hola qué tal");
    expect(sumarDictado("Arrancamos.", "mañana sigue")).toBe("Arrancamos. Mañana sigue");
    expect(sumarDictado("Llamar a", " la constructora")).toBe("Llamar a la constructora");
    expect(sumarDictado("Algo", "   ")).toBe("Algo");
  });
});
