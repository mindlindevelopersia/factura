import { describe, expect, it } from "vitest";
import { calcularPropuesta, parametrosIniciales, propuestaAUrl } from "./propuesta";
import { filaDePropuesta, mensajePropuesta, propuestaDeFila, validarPropuesta, whatsappPropuesta, type PropuestaGuardada } from "./propuestasGuardadas";

const p = { ...parametrosIniciales({ cliente: "Persona Inventada", unidad: "2C", precioUsd: 100000, tipoCambio: 1500, hoy: "2026-11-01", entrega: "2028-04" }) };
const r = calcularPropuesta(p);

describe("propuestas guardadas", () => {
  it("ida y vuelta por la fila de la planilla", () => {
    const g: PropuestaGuardada = { id: "x1", proyecto: "lerma-439", creada: "2026-11-01T10:00:00.000Z", actualizada: "2026-11-02T10:00:00.000Z", autor: "Mati", editor: "Tade", cliente: "Persona Inventada", contactoId: "c1", unidad: "2C", precioUsd: 100000, totalArs: 150000000, vence: "2026-11-08", parametros: propuestaAUrl(p) };
    expect(propuestaDeFila(filaDePropuesta(g))).toEqual(g);
  });

  it("valida lo que llega", () => {
    expect(validarPropuesta({ unidad: "", precioUsd: 1, totalArs: 1, vence: "2026-11-08", parametros: "a=1" })).toEqual({ error: "Falta la unidad." });
    expect(validarPropuesta({ unidad: "2C", precioUsd: "mucho", totalArs: 1, vence: "2026-11-08", parametros: "a=1" })).toEqual({ error: "El valor no es un número." });
    const ok = validarPropuesta({ cliente: "  Persona Inventada ", unidad: "2C", precioUsd: 100000, totalArs: 150000000, vence: "2026-11-08", parametros: "a=1" });
    expect("datos" in ok && ok.datos.cliente).toBe("Persona Inventada");
  });

  it("arma el mensaje de WhatsApp con el anticipo, las cuotas y los refuerzos", () => {
    const m = mensajePropuesta(p, r, "LERMA 439");
    expect(m).toContain("¡Hola Persona!");
    expect(m).toContain("UF 2C de LERMA 439");
    expect(m).toContain("Anticipo a la firma: US$ 11.000");
    expect(m).toContain(`${p.cuotas.cantidad} cuotas mensuales`);
    expect(m).toContain("2 refuerzos en diciembre 2026 y diciembre 2027");
    expect(m).not.toMatch(/\n\n\n/);
  });

  it("el link va al teléfono del contacto, o deja elegir", () => {
    expect(whatsappPropuesta("11 0000 0001", "hola")).toBe("https://wa.me/5491100000001?text=hola");
    expect(whatsappPropuesta("", "hola")).toBe("https://wa.me/?text=hola");
  });
});
