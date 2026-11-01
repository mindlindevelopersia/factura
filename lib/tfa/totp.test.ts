import { describe, expect, it } from "vitest";
import { dispositivoValido, firmarDispositivo, SIN_SEGUNDO_FACTOR } from "./dispositivo";
import { base32, claveLegible, codigo, codigoValido, desdeBase32, linkApp, nuevaClave } from "./totp";

// Vectores del RFC 6238 (SHA-1, clave "12345678901234567890"), los últimos 6 dígitos.
const RFC = base32(Buffer.from("12345678901234567890"));

describe("verificación en dos pasos", () => {
  it("códigos del RFC 6238", () => {
    expect(codigo(RFC, Math.floor(59 / 30))).toBe("287082");
    expect(codigo(RFC, Math.floor(1111111109 / 30))).toBe("081804");
    expect(codigo(RFC, Math.floor(1234567890 / 30))).toBe("005924");
    expect(codigo(RFC, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("base32 ida y vuelta y claves nuevas", () => {
    const k = nuevaClave();
    expect(k).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32(desdeBase32(k))).toBe(k);
    expect(claveLegible("ABCDEFGH")).toBe("ABCD EFGH");
    expect(linkApp("persona@ejemplo.com", k)).toContain(`secret=${k}`);
  });

  it("acepta el código de ahora y los vecinos (con espacios), no otros", () => {
    const t = 1_700_000_000_000;
    const paso = Math.floor(t / 30000);
    expect(codigoValido(RFC, codigo(RFC, paso), t)).toBe(true);
    expect(codigoValido(RFC, codigo(RFC, paso - 1).replace(/(\d{3})/, "$1 "), t)).toBe(true);
    expect(codigoValido(RFC, codigo(RFC, paso + 3), t)).toBe(false);
    expect(codigoValido(RFC, "12345", t)).toBe(false);
  });

  it("el navegador recordado: del mismo mail, sin vencer y sin tocar", async () => {
    const s = "secreto-de-prueba";
    const v = await firmarDispositivo("Persona@Ejemplo.com", 2_000, s);
    expect(await dispositivoValido(v, "persona@ejemplo.com", s, 1_000)).toBe(true);
    expect(await dispositivoValido(v, "otra@ejemplo.com", s, 1_000)).toBe(false);
    expect(await dispositivoValido(v, "persona@ejemplo.com", s, 3_000)).toBe(false);
    expect(await dispositivoValido(v, "persona@ejemplo.com", "otro-secreto", 1_000)).toBe(false);
    expect(await dispositivoValido(v.replace(".2000.", ".9999999.") , "persona@ejemplo.com", s, 1_000)).toBe(false);
    expect(await dispositivoValido(undefined, "persona@ejemplo.com", s)).toBe(false);
  });

  it("solo la página de verificación y su API andan sin el código", () => {
    expect(SIN_SEGUNDO_FACTOR("/verificar")).toBe(true);
    expect(SIN_SEGUNDO_FACTOR("/api/tfa/verificar")).toBe(true);
    expect(SIN_SEGUNDO_FACTOR("/api/inversores/cuentas")).toBe(false);
    expect(SIN_SEGUNDO_FACTOR("/verificarx")).toBe(false);
  });
});

describe("claves cifradas", async () => {
  const { cifrar, descifrar } = await import("./cifrado");
  it("se descifran con el mismo secreto y no con otro", () => {
    const c = cifrar("CLAVEDEPRUEBA234", "s1");
    expect(c).not.toContain("CLAVEDEPRUEBA234");
    expect(descifrar(c, "s1")).toBe("CLAVEDEPRUEBA234");
    expect(descifrar(c, "s2")).toBeNull();
    expect(descifrar("basura", "s1")).toBeNull();
  });
});
