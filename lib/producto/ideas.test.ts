import { describe, expect, it } from "vitest";
import { requisitoDeRuta } from "../permisos/modelo";
import { rutaDeTarea } from "../tareas/modelo";
import { filaDeIdea, ideaDeFila, ordenarIdeas, validarIdea, type Idea } from "./ideas";

const idea = (id: string, actualizada: string): Idea => ({ id, titulo: `Idea ${id}`, texto: "", autor: "Persona", creada: actualizada, actualizada, estado: "Abierta", featureId: "" });

describe("producto", () => {
  it("ida y vuelta por la fila y validación", () => {
    const i = { ...idea("a", "2026-11-01T10:00:00.000Z"), texto: "Algo\ncon renglones", estado: "En features" as const, featureId: "f1" };
    expect(ideaDeFila(filaDeIdea(i))).toEqual(i);
    expect(validarIdea({ texto: "x" }, true)).toEqual({ error: "La idea necesita un título." });
    expect(validarIdea({ estado: "Cualquiera" }, false)).toEqual({ error: "Estado inválido." });
    expect(validarIdea({ titulo: " Compras " }, true)).toEqual({ cambios: { titulo: "Compras" } });
  });

  it("primero las que tuvieron actividad más reciente (también por comentarios)", () => {
    const l = ordenarIdeas([idea("a", "2026-10-01T00:00:00Z"), idea("b", "2026-10-05T00:00:00Z")], [{ ideaId: "a", fecha: "2026-10-10T00:00:00Z", usuario: "x", texto: "y" }]);
    expect(l.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("los features abren en Producto y las tareas en su proyecto", () => {
    expect(rutaDeTarea({ id: "t1", proyecto: "producto" })).toBe("/producto/features?tarea=t1");
    expect(rutaDeTarea({ id: "t2", proyecto: "" })).toBe("/proyectos/lerma-439/tareas?tarea=t2");
  });

  it("permisos: Producto es de la empresa, con sus dos módulos", () => {
    expect(requisitoDeRuta("/producto/ideas")).toEqual({ clave: "producto/ideas" });
    expect(requisitoDeRuta("/producto")).toEqual({ area: "producto" });
    expect(requisitoDeRuta("/indicadores/cac")).toEqual({ clave: "indicadores/cac" });
  });
});
