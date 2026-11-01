import { describe, expect, it } from "vitest";
import { comentarioDatoDeFila, filaDeComentarioDato, hilos, participantes, rutaBase, validarComentario, type ComentarioDato } from "./modelo";

const c = (id: string, padre = "", usuario = "Mati", fecha = `2026-11-0${id.length}T10:00:00Z`, clave = "pf:x:gcba"): ComentarioDato => ({ id, clave, padre, fecha, usuario, texto: `nota ${id}`, ruta: "/prefactibilidad?id=x", etiqueta: "Lote · GCBA" });

describe("comentarios en los números", () => {
  it("arma los hilos: cada nota con sus respuestas", () => {
    const l = [c("a"), c("bb", "a", "Tade"), c("ccc", "a", "Persona"), c("dddd"), c("e", "", "Mati", "2026-11-09T00:00:00Z", "pf:x:otro")];
    const h = hilos(l, "pf:x:gcba");
    expect(h.map((x) => [x.raiz.id, x.respuestas.map((r) => r.id)])).toEqual([
      ["a", ["bb", "ccc"]],
      ["dddd", []],
    ]);
    expect(participantes(h[0])).toEqual(["Mati", "Tade", "Persona"]);
  });

  it("una respuesta a algo que ya no está queda como nota suelta", () => {
    expect(hilos([c("a", "borrado")], "pf:x:gcba")[0].raiz.id).toBe("a");
  });

  it("valida lo que llega", () => {
    expect(validarComentario({ clave: "pf:x:gcba", texto: "  ", ruta: "/x" })).toEqual({ error: "El comentario está vacío." });
    expect(validarComentario({ clave: "pf x <script>", texto: "hola", ruta: "/x" })).toEqual({ error: "Dato inválido." });
    expect(validarComentario({ clave: "pf:x:gcba", texto: "hola", ruta: "http://otro" })).toEqual({ error: "Página inválida." });
    expect(validarComentario({ clave: "cf:lerma-439:real:obra:2026-03", texto: " Lo pagó la constructora ", ruta: "/proyectos/lerma-439/finanzas/cash-flow" })).toMatchObject({ datos: { texto: "Lo pagó la constructora", padre: "" } });
  });

  it("ida y vuelta por la fila; la ruta base sin el ?id", () => {
    expect(comentarioDatoDeFila(filaDeComentarioDato(c("a")))).toEqual(c("a"));
    expect(rutaBase("/prefactibilidad?id=x")).toBe("/prefactibilidad");
    expect(rutaBase("/proyectos/lerma-439/")).toBe("/proyectos/lerma-439");
  });
});
