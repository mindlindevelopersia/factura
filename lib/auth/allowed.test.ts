import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./allowed";

describe("isAllowedEmail", () => {
  const lista = " Ana@Mindlin.com.ar, juan@gmail.com ;pedro@mindlin.com.ar\n";

  it("acepta los mails de la lista sin importar mayúsculas ni espacios", () => {
    expect(isAllowedEmail("ana@mindlin.com.ar", lista)).toBe(true);
    expect(isAllowedEmail("JUAN@gmail.com", lista)).toBe(true);
    expect(isAllowedEmail("pedro@mindlin.com.ar", lista)).toBe(true);
  });

  it("rechaza los que no están, aunque sean del mismo dominio", () => {
    expect(isAllowedEmail("otro@mindlin.com.ar", lista)).toBe(false);
    expect(isAllowedEmail("ana@mindlin.com", lista)).toBe(false);
  });

  it("rechaza todo si la lista está vacía o no hay mail", () => {
    expect(isAllowedEmail("ana@mindlin.com.ar", "")).toBe(false);
    expect(isAllowedEmail(null, lista)).toBe(false);
    expect(isAllowedEmail("", lista)).toBe(false);
  });
});
