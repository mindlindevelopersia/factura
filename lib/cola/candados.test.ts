import { describe, expect, it } from "vitest";
import { CandadosSheets } from "./candados";

/** La pestaña en memoria. Como Sheets: cada agregado va al final, de a uno. */
class PestaniaEnMemoria {
  filas_: string[][] = [];
  async agregar(valores: string[]) {
    this.filas_.push(valores);
    return this.filas_.length + 1;
  }
  async filas() {
    return this.filas_.map((f) => [...f]);
  }
  async escribir(fila: number, valores: string[]) {
    this.filas_[fila - 2] = valores;
  }
}

const ahora = () => new Date("2026-10-29T15:00:00Z");

describe("CandadosSheets", () => {
  it("de dos intentos a la vez gana uno solo", async () => {
    const candados = new CandadosSheets(new PestaniaEnMemoria(), ahora);
    const [a, b] = await Promise.all([candados.tomar("factura:1", 60_000), candados.tomar("factura:1", 60_000)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("gana el primero que agregó su fila, aunque el otro lea antes", async () => {
    const pestania = new PestaniaEnMemoria();
    const candados = new CandadosSheets(pestania, ahora);
    // Alguien ya agregó su fila y todavía no leyó.
    pestania.filas_.push(["factura:1", "otro", "2026-10-29T15:00:00Z", "2026-10-29T15:01:00Z"]);
    expect(await candados.tomar("factura:1", 60_000)).toBeNull();
    // El que perdió libera su fila: cuando el otro suelta, el siguiente entra.
    pestania.filas_[0][3] = "liberado";
    expect(await candados.tomar("factura:1", 60_000)).not.toBeNull();
  });

  it("soltar libera el candado y otra clave no se traba", async () => {
    const candados = new CandadosSheets(new PestaniaEnMemoria(), ahora);
    const a = await candados.tomar("aprobar:1", 60_000);
    expect(await candados.tomar("aprobar:2", 60_000)).not.toBeNull();
    expect(await candados.tomar("aprobar:1", 60_000)).toBeNull();
    await a!.soltar();
    expect(await candados.tomar("aprobar:1", 60_000)).not.toBeNull();
  });

  it("uno vencido no traba", async () => {
    const pestania = new PestaniaEnMemoria();
    pestania.filas_.push(["aprobar:1", "viejo", "2026-10-29T14:00:00Z", "2026-10-29T14:02:00Z"]);
    expect(await new CandadosSheets(pestania, ahora).tomar("aprobar:1", 60_000)).not.toBeNull();
  });
});
