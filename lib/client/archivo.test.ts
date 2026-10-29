import { describe, expect, it } from "vitest";
import { errorArchivo, TAMANIO_MAXIMO_WEB } from "./archivo";

describe("validación antes de subir", () => {
  it("rechaza vacíos y formatos arrastrados no compatibles antes de enviarlos", () => {
    expect(errorArchivo({ type: "application/pdf", size: 0 })).toContain("vacío");
    expect(errorArchivo({ type: "application/zip", size: 100 })).toContain("Formato no compatible");
  });
  it("limita PDF y permite comprimir fotos grandes", () => {
    expect(errorArchivo({ type: "application/pdf", size: TAMANIO_MAXIMO_WEB + 1 })).toContain("4,3 MB");
    expect(errorArchivo({ type: "image/jpeg", size: 9_000_000 })).toBeNull();
  });
});
