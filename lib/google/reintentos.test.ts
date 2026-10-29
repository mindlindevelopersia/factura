import { describe, expect, it } from "vitest";
import { conReintentos, reintentable } from "./reintentos";

const error = (status?: number) => Object.assign(new Error("x"), status ? { response: { status } } : {});
const sinEsperar = { dormir: async () => {} };

describe("reintentos de Google", () => {
  it("la cuota agotada se reintenta siempre; un 500 o un corte, solo si el pedido es idempotente", () => {
    expect(reintentable(error(429), false)).toBe(true);
    expect(reintentable(error(503), true)).toBe(true);
    expect(reintentable(error(503), false)).toBe(false);
    expect(reintentable(error(), true)).toBe(true);
    expect(reintentable(error(), false)).toBe(false);
    expect(reintentable(error(403), true)).toBe(false);
  });

  it("reintenta hasta que sale", async () => {
    let n = 0;
    const r = await conReintentos(async () => (++n < 3 ? Promise.reject(error(429)) : "ok"), false, sinEsperar);
    expect(r).toBe("ok");
    expect(n).toBe(3);
  });

  it("se rinde después del último intento y no reintenta lo que no corresponde", async () => {
    let n = 0;
    await expect(conReintentos(async () => Promise.reject(error(429 + 0 * ++n)), false, sinEsperar)).rejects.toThrow();
    expect(n).toBe(4);
    n = 0;
    await expect(conReintentos(async () => Promise.reject(error(500 + 0 * ++n)), false, sinEsperar)).rejects.toThrow();
    expect(n).toBe(1);
  });
});
