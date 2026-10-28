import { describe, expect, it } from "vitest";
import type { PestaniaSimple } from "../google/pestania";
import { UsuariosTelegram } from "./usuarios";

/** La pestaña "Telegram" en memoria. */
function pestania() {
  const filas: string[][] = [];
  const falsa = {
    filas: async () => filas,
    agregar: async (v: string[]) => void filas.push(v),
    escribir: async (fila: number, v: string[]) => void (filas[fila - 2] = v),
  };
  return { filas, pestania: falsa as unknown as PestaniaSimple };
}

describe("UsuariosTelegram", () => {
  const ahora = () => new Date("2026-10-29T15:00:00Z");

  it("un mail puede tener varias cuentas de Telegram", async () => {
    const { pestania: p } = pestania();
    const u = new UsuariosTelegram(p, ahora);
    await u.vincular(1, "@celu_trabajo", "Tadeo@Mindlin.com");
    await u.vincular(2, "@celu_personal", "tadeo@mindlin.com");
    await u.vincular(3, "@ana", "ana@x.com");
    expect((await u.telegramsDe("tadeo@mindlin.com")).map((c) => c.usuario)).toEqual(["@celu_trabajo", "@celu_personal"]);
    expect(await u.emailDe(2)).toBe("tadeo@mindlin.com");
  });

  it("una cuenta de Telegram va a un solo mail: conectarla de nuevo la pasa al otro", async () => {
    const { pestania: p, filas } = pestania();
    const u = new UsuariosTelegram(p, ahora);
    await u.vincular(1, "@tadeo", "tadeo@mindlin.com");
    await u.vincular(1, "@tadeo", "ana@x.com");
    expect(filas).toHaveLength(1);
    expect(await u.emailDe(1)).toBe("ana@x.com");
  });

  it("solo se puede desconectar una cuenta propia", async () => {
    const { pestania: p } = pestania();
    const u = new UsuariosTelegram(p, ahora);
    await u.vincular(1, "@tadeo", "tadeo@mindlin.com");
    expect(await u.desvincular(1, "ana@x.com")).toBe(false);
    expect(await u.emailDe(1)).toBe("tadeo@mindlin.com");
    expect(await u.desvincular(1, "tadeo@mindlin.com")).toBe(true);
    expect(await u.emailDe(1)).toBeNull();
    expect(await u.telegramsDe("tadeo@mindlin.com")).toEqual([]);
  });
});
