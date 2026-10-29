import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * El código del script está copiado en los prompts de computer use, porque el agente no puede
 * abrir el repo. Si se cambia guardar-factura.gs, hay que pegarlo también ahí.
 */
describe("código de Apps Script en los prompts", () => {
  const codigo = readFileSync("apps-script/guardar-factura.gs", "utf8").trim();
  for (const doc of ["apps-script/README.md", "docs/configurar-con-computer-use.md", "docs/mapa.md"]) {
    it(`${doc} tiene el código actual`, () => {
      expect(readFileSync(doc, "utf8")).toContain(codigo);
    });
  }
});
