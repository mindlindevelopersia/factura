import { describe, expect, it } from "vitest";
import { contactoDeFila, type Contacto } from "../crm/modelo";
import type { Egreso } from "../finanzas/egresos";
import type { Pago } from "../finanzas/ingresos";
import { eventosCobros, eventosLeads, eventosPagos, eventosPropuestas, semanasDelMes, validarAgenda } from "./eventos";

const pago = (mes: string, monto: number, detalle = "Cuota mensual"): Pago => ({ inversor: "Persona Inventada", unidad: "3B", tipo: "cuota", detalle, bn: "blanco", moneda: "ARS", mes, monto, estado: "a cobrar", atrasado: false, celda: "A1" }) as unknown as Pago;
const contacto = (c: Partial<Contacto>): Contacto => ({ ...contactoDeFila(["c1", "", "Lead Inventado"]), ...c });

describe("calendario", () => {
  it("los cobros vencen el 10 (o el día especial) y lo pasado queda vencido", () => {
    const ev = eventosCobros([{ inversor: "Persona Inventada", unidad: "3B", pendientes: [pago("2026-10", 100), pago("2026-11", 100), pago("2026-12", 0)] }], "2026-11-01");
    expect(ev.map((e) => [e.fecha, e.vencido])).toEqual([
      ["2026-10-10", true],
      ["2026-11-10", false],
    ]);
    expect(eventosCobros([{ inversor: "Marcelo Martín", unidad: "1A", pendientes: [pago("2026-11", 5)] }], "2026-11-01")[0].fecha).toBe("2026-11-20");
  });

  it("los pagos son los del proyecto", () => {
    const e = (proyecto: string): Egreso => ({ fecha: "2026-10-15", mes: "2026-10", descripcion: "Hormigón", categoria: "Materiales", rubro: "materiales", proyecto, bn: "blanco", moneda: "ARS", monto: 10, forma: "", banco: "", pestania: "Caja", fila: 3 }) as Egreso;
    expect(eventosPagos([e("Lerma 439"), e("HQ"), e("LERMA")], "Lerma 439")).toHaveLength(2);
  });

  it("leads: el próximo paso de los abiertos y volver a contactar a los cerrados", () => {
    const ev = eventosLeads(
      [
        contacto({ id: "a", etapa: "Interesado", proximaFecha: "2026-10-30", proximoPaso: "Mandar propuesta", proyectos: ["lerma-439"] }),
        contacto({ id: "b", etapa: "Perdido", proximaFecha: "2026-11-05", volverAContactar: "2027-03-01" }),
        contacto({ id: "c", etapa: "Interesado", proximaFecha: "2026-11-05", proyectos: ["guemes-4676"] }),
      ],
      "lerma-439",
      "2026-11-01",
    );
    expect(ev.map((e) => [e.id, e.fecha, e.vencido])).toEqual([
      ["lead-a", "2026-10-30", true],
      ["volver-b", "2027-03-01", false],
    ]);
  });

  it("propuestas: el día que vencen", () => {
    const ev = eventosPropuestas([{ id: "p1", proyecto: "lerma-439", creada: "", actualizada: "", autor: "Mati", editor: "Mati", cliente: "Persona Inventada", contactoId: "", unidad: "2C", precioUsd: 1, totalArs: 1, vence: "2026-11-08", parametros: "a=1" }]);
    expect(ev[0]).toMatchObject({ fecha: "2026-11-08", titulo: "Vence la propuesta UF 2C · Persona Inventada" });
  });

  it("la grilla del mes arranca el lunes", () => {
    const s = semanasDelMes("2026-11"); // 1/11/2026 es domingo
    expect(s[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(s.at(-1)!.filter(Boolean).at(-1)).toBe("2026-11-30");
    expect(s.every((w) => w.length === 7)).toBe(true);
  });

  it("valida lo que se carga a mano", () => {
    expect(validarAgenda({ fecha: "", titulo: "x" })).toEqual({ error: "Falta la fecha." });
    expect(validarAgenda({ fecha: "2026-11-03", titulo: "Pagar certificado", categoria: "Cualquiera" })).toEqual({ datos: { fecha: "2026-11-03", categoria: "Otro", titulo: "Pagar certificado", detalle: "" } });
  });
});
