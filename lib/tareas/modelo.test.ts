import { describe, expect, it } from "vitest";
import { eventosTareas } from "../calendario/eventos";
import { aplicarCambios, bloqueaA, columnaDe, filaDeTarea, haceCirculo, nuevaTarea, ordenar, subtareasDeCelda, tareaDeFila, validarCambios, type Tarea } from "./modelo";

const ahora = "2026-11-01T12:00:00.000Z";
const t = (id: string, c: Partial<Tarea> = {}): Tarea => ({ ...nuevaTarea(id, { titulo: `Tarea ${id}` }, "Mati", ahora, "lerma-439"), ...c });

describe("tareas", () => {
  it("ida y vuelta por la fila, con subtareas legibles en la planilla", () => {
    const x = t("a", { descripcion: "Algo\ncon renglones", subtareas: [{ texto: "Pedir presupuesto", hecha: true }, { texto: "Comparar", hecha: false }], bloqueadaPor: ["b", "c"], vence: "2026-11-10", hora: "9:30" });
    const fila = filaDeTarea(x);
    expect(fila[15]).toBe("[x] Pedir presupuesto\n[ ] Comparar");
    expect(tareaDeFila(fila)).toEqual(x);
    expect(subtareasDeCelda("Sin corchetes\n\n[X] Hecha")).toEqual([
      { texto: "Sin corchetes", hecha: false },
      { texto: "Hecha", hecha: true },
    ]);
  });

  it("bloqueada mientras la que la bloquea siga abierta o haya un motivo", () => {
    const b = t("b");
    const a = t("a", { bloqueadaPor: ["b"], estado: "En curso" });
    expect(columnaDe(a, [a, b])).toBe("Bloqueada");
    const bHecha = { ...b, estado: "Hecha" as const };
    expect(columnaDe(a, [a, bHecha])).toBe("En curso");
    expect(columnaDe(t("c", { motivoBloqueo: "Espera al escribano" }), [])).toBe("Bloqueada");
    expect(columnaDe(t("d", { estado: "Cancelada" }), [])).toBe(null);
    expect(bloqueaA(b, [a, b]).map((x) => x.id)).toEqual(["a"]);
  });

  it("no deja armar círculos de bloqueos", () => {
    const a = t("a", { bloqueadaPor: ["b"] });
    const b = t("b", { bloqueadaPor: ["c"] });
    const c = t("c");
    expect(haceCirculo("c", "a", [a, b, c])).toBe(true);
    expect(haceCirculo("a", "c", [a, b, c])).toBe(false);
  });

  it("anota cuándo se terminó y no se bloquea a sí misma", () => {
    const a = aplicarCambios(t("a"), { estado: "Hecha", bloqueadaPor: ["a", "b"] }, "2026-11-02T10:00:00.000Z");
    expect(a.terminada).toBe("2026-11-02T10:00:00.000Z");
    expect(a.bloqueadaPor).toEqual(["b"]);
    expect(aplicarCambios(a, { estado: "Por hacer" }, ahora).terminada).toBe(null);
  });

  it("valida lo que llega", () => {
    expect(validarCambios({}, true)).toEqual({ error: "Falta qué hay que hacer." });
    expect(validarCambios({ titulo: "x", vence: "10/11" }, true)).toEqual({ error: "La fecha no es válida." });
    const ok = validarCambios({ titulo: " Llamar ", estado: "Rara", subtareas: [{ texto: "  uno " }, { texto: "" }] }, true);
    expect(ok).toEqual({ cambios: { titulo: "Llamar", estado: "Por hacer", subtareas: [{ texto: "uno", hecha: false }] } });
  });

  it("ordena: urgentes primero, después por fecha", () => {
    const l = [t("a", { vence: "2026-11-20" }), t("b", { prioridad: "Urgente" }), t("c", { vence: "2026-11-05" })].sort(ordenar);
    expect(l.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("en el calendario: las abiertas con fecha del proyecto y las generales", () => {
    const ev = eventosTareas([t("a", { vence: "2026-10-30" }), t("b", { vence: "2026-11-05", proyecto: "" }), t("c", { vence: "2026-11-05", proyecto: "otro" }), t("d", { vence: "2026-11-05", estado: "Hecha" }), t("e")], "lerma-439", "2026-11-01");
    expect(ev.map((e) => [e.id, e.vencido])).toEqual([
      ["tarea-a", true],
      ["tarea-b", false],
    ]);
  });
});
