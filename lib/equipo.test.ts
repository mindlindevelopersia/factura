import { describe, expect, it } from "vitest";
import { persona, saludoDelMomento } from "./equipo";

describe("saludo", () => {
  it("según la hora de Buenos Aires (UTC−3)", () => {
    expect(saludoDelMomento(new Date("2026-11-01T11:00:00Z"))).toBe("Buenos días"); // 8 h
    expect(saludoDelMomento(new Date("2026-11-01T15:59:00Z"))).toBe("Buenos días"); // 12:59
    expect(saludoDelMomento(new Date("2026-11-01T16:00:00Z"))).toBe("Buenas tardes"); // 13 h
    expect(saludoDelMomento(new Date("2026-11-01T23:30:00Z"))).toBe("Buenas noches"); // 20:30
    expect(saludoDelMomento(new Date("2026-11-01T06:00:00Z"))).toBe("Buenas noches"); // 3 h
  });

  it("con el apodo del equipo o el primer nombre de la cuenta", () => {
    expect(persona("MatiMindlin111@gmail.com").apodo).toBe("Mati");
    expect(persona("mindlindevops@gmail.com").apodo).toBe("Tade");
    expect(persona("otra@x.com", "Laura Pérez").apodo).toBe("Laura");
    expect(persona("otra@x.com", null).apodo).toBe("otra");
  });
});
