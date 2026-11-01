import { describe, expect, it } from "vitest";
import { validarCambios } from "../tareas/modelo";
import { PENDIENTES, pendientesSinCargar } from "./pendientes";

describe("features pendientes", () => {
  it("cada uno explica qué falta y el primer paso, y pasa las reglas de una tarea", () => {
    for (const p of PENDIENTES) {
      expect(p.descripcion).toContain("Qué falta:");
      expect(p.descripcion).toContain("Primer paso:");
      expect("cambios" in validarCambios({ titulo: p.titulo, descripcion: p.descripcion, prioridad: p.prioridad }, true)).toBe(true);
    }
    expect(new Set(PENDIENTES.map((p) => p.titulo)).size).toBe(PENDIENTES.length);
  });

  it("no repite lo que ya está en el tablero (sin importar tildes ni mayúsculas)", () => {
    const resto = pendientesSinCargar(["presupuesto base 0", "Módulo de compras y presupuestos", "Otra cosa"]);
    expect(resto.length).toBe(PENDIENTES.length - 2);
    expect(resto.some((p) => p.titulo === "Presupuesto base 0")).toBe(false);
  });
});
