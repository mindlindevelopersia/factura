import { describe, expect, it } from "vitest";
import { asignarCarpetas, documentosDe, parecido, tipoDocumento } from "./documentos";

const cuentas = [
  { id: "2c-persona-uno", inversor: "Persona Uno", unidad: "2C" },
  { id: "3a-otra-persona", inversor: "Otra Persona", unidad: "3A" },
  { id: "4b-mariana-ejemplo", inversor: "Mariana Ejemplo", unidad: "4B" },
  { id: "5d-mariana-ejemplo", inversor: "Mariana Ejemplo", unidad: "5D" },
  { id: "6a-juan-gomez", inversor: "Juan Gómez & Ana Ruiz", unidad: "6A" },
];

describe("documentación de los inversores", () => {
  it("el tipo sale del nombre del archivo", () => {
    expect(tipoDocumento("Compromiso de Deuda - firmado.pdf")).toBe("Compromiso de deuda");
    expect(tipoDocumento("BOLETO REAL UF 2C.pdf")).toBe("Boleto");
    expect(tipoDocumento("escaneo 0001.pdf")).toBe("Documento");
  });

  it("parecido: la unidad pesa más que una palabra del nombre", () => {
    expect(parecido("UF 2C - Persona Uno", cuentas[0])).toBe(5);
    expect(parecido("Persona Uno", cuentas[0])).toBe(2);
    expect(parecido("2C", cuentas[0])).toBe(3);
    expect(parecido("Gomez Juan", cuentas[4])).toBe(2);
  });

  it("asigna las claras, deja sin asignar las dudosas y respeta las elegidas a mano", () => {
    const carpetas = [
      { id: "c1", nombre: "Persona Uno" },
      { id: "c2", nombre: "Mariana Ejemplo" },
      { id: "c3", nombre: "Persona" },
      { id: "c4", nombre: "Gómez" },
      { id: "c5", nombre: "Alguien Desconocido" },
      { id: "c6", nombre: "Lo que sea" },
    ];
    const a = asignarCarpetas(carpetas, cuentas, { c6: "3a-otra-persona" });
    expect(a.porCuenta["2c-persona-uno"]).toEqual(["c1"]);
    // Mismo inversor con dos unidades: va a las dos.
    expect(a.porCuenta["4b-mariana-ejemplo"]).toEqual(["c2"]);
    expect(a.porCuenta["5d-mariana-ejemplo"]).toEqual(["c2"]);
    // "Persona" está en dos inversores distintos: dudosa.
    expect(a.sinAsignar).toContain("c3");
    // "Gómez" está en uno solo: alcanza.
    expect(a.porCuenta["6a-juan-gomez"]).toEqual(["c4"]);
    expect(a.sinAsignar).toContain("c5");
    expect(a.porCuenta["3a-otra-persona"]).toEqual(["c6"]);
  });

  it("solo PDF e imágenes, los más nuevos primero", () => {
    const d = documentosDe({
      id: "c1",
      nombre: "Persona Uno",
      archivos: [
        { id: "a", nombre: "Boleto.pdf", mimeType: "application/pdf", modificado: "2025-01-01" },
        { id: "b", nombre: "Compromiso.pdf", mimeType: "application/pdf", modificado: "2025-06-01" },
        { id: "c", nombre: "Boleto editable.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", modificado: "2025-07-01" },
      ],
    });
    expect(d.map((x) => [x.id, x.tipo])).toEqual([
      ["b", "Compromiso de deuda"],
      ["a", "Boleto"],
    ]);
  });
});
