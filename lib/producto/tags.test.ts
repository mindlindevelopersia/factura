import { describe, expect, it } from "vitest";
import { filaDeIdea, ideaDeFila, validarIdea, type Idea } from "./ideas";
import { IDEAS_SUGERIDAS } from "./sugeridas";
import { esDelArea, GRUPOS_TAGS, limpiarTags, TODOS_LOS_TAGS } from "./tags";

describe("tags de las ideas", () => {
  it("salen de las áreas del hub, sin repetir Prefactibilidad", () => {
    const areas = GRUPOS_TAGS.map((g) => g.area);
    expect(areas).toContain("Marketing");
    expect(areas).toContain("Comercial");
    expect(areas.filter((a) => a === "Prefactibilidad")).toHaveLength(1);
    expect(TODOS_LOS_TAGS).toContain("Marketing · Blog");
    expect(TODOS_LOS_TAGS).toContain("Comercial · CRM");
  });

  it("limpia: solo conocidos, sin repetir, en el orden del menú", () => {
    expect(limpiarTags(["Marketing · Blog", "Inventado", "Indicadores", "Marketing · Blog"])).toEqual(["Indicadores", "Marketing · Blog"]);
    expect(limpiarTags("Marketing, Producto")).toEqual(["Marketing", "Producto"]);
    expect(limpiarTags(null)).toEqual([]);
  });

  it("van y vuelven por la planilla y se validan", () => {
    const i: Idea = { id: "a", titulo: "X", texto: "", autor: "P", creada: "2026-11-01", actualizada: "2026-11-01", estado: "Abierta", featureId: "", tags: ["Marketing", "Marketing · Pauta"] };
    expect(filaDeIdea(i)[8]).toBe("Marketing, Marketing · Pauta");
    expect(ideaDeFila(filaDeIdea(i))).toEqual(i);
    expect(ideaDeFila(["b", "Vieja", "", "P", "2026-10-01"]).tags).toEqual([]);
    expect(validarIdea({ titulo: "Y", tags: ["Ajustes", "nada"] }, true)).toEqual({ cambios: { titulo: "Y", tags: ["Ajustes"] } });
  });

  it("filtra por área (por el área o por un módulo suyo)", () => {
    expect(esDelArea(["Marketing · Blog"], "Marketing")).toBe(true);
    expect(esDelArea(["Indicadores"], "Marketing")).toBe(false);
  });

  it("la idea sugerida de Marketing trae lo que falta, con tags válidos", () => {
    const m = IDEAS_SUGERIDAS.find((s) => s.clave === "marketing-lo-que-falta")!;
    expect(limpiarTags(m.tags)).toEqual(m.tags);
    expect(m.tags).toContain("Marketing · Analítica");
    expect(m.texto).toContain("Primer paso");
    expect(m.texto).toContain("PARA DECIDIR");
    expect(m.texto.indexOf("Analítica")).toBeLessThan(m.texto.indexOf("Contenido para redes"));
  });
});
