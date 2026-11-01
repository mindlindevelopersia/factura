import { describe, expect, it } from "vitest";
import { contactoDeFila } from "../crm/modelo";
import { resultadosCuentas, resultadosLeads } from "./datos";
import { buscar, paginas, type Resultado } from "./indice";

const r = (tipo: Resultado["tipo"], titulo: string, proyecto = "", extra = ""): Resultado => ({ tipo, etiqueta: tipo, titulo, detalle: "", href: `/${titulo}`, proyecto, extra });

describe("buscador", () => {
  it("encuentra sin tildes ni mayúsculas, con lo que empieza igual primero", () => {
    const items = [r("Lead", "Persona Matías Inventada"), r("Lead", "Matías Inventado"), r("Cobro", "Otra Persona"), r("Página", "Materiales")];
    expect(buscar(items, "matia").map((x) => x.titulo)).toEqual(["Matías Inventado", "Persona Matías Inventada"]);
    expect(buscar(items, "MATER").map((x) => x.titulo)).toEqual(["Materiales"]);
    expect(buscar(items, "")).toEqual([]);
  });

  it("todas las palabras tienen que estar (también en los datos extra)", () => {
    const items = [r("Lead", "Lead Inventado", "", "11 0000 0001 lead@ejemplo.com"), r("Lead", "Otro Inventado")];
    expect(buscar(items, "inventado 0001").map((x) => x.titulo)).toEqual(["Lead Inventado"]);
  });

  it("los del proyecto en el que estás van primero", () => {
    const items = [r("Unidad", "UF 2C", "otro"), r("Unidad", "UF 2C", "lerma-439")];
    expect(buscar(items, "2c", "lerma-439")[0].proyecto).toBe("lerma-439");
  });

  it("las páginas incluyen los módulos de la empresa y los desarrolladores", () => {
    const p = paginas();
    expect(buscar(p, "materiales")[0]).toMatchObject({ titulo: "Materiales", etiqueta: "Indicadores" });
    expect(buscar(p, "mindlin").some((x) => x.tipo === "Desarrollador")).toBe(true);
    expect(buscar(p, "tareas")[0].tipo).toBe("Página");
  });

  it("leads y cobros con su link y etiqueta", () => {
    const [lead] = resultadosLeads([{ ...contactoDeFila(["c1", "", "Lead Inventado"]), proyectos: ["lerma-439"], etapa: "Interesado" }]);
    expect(lead).toMatchObject({ etiqueta: "Lead", href: "/proyectos/lerma-439/comercial/crm?contacto=c1" });
    const pago = (mes: string) => ({ mes, monto: 10, moneda: "ARS", detalle: "Cuota" }) as never;
    const res = resultadosCuentas("lerma-439", [{ id: "3b-x", inversor: "Persona Inventada", unidad: "3B", telefono: "", pendientes: [pago("2026-10"), pago("2026-11")] }], "2026-11-01");
    expect(res.map((x) => x.etiqueta)).toEqual(["Inversor", "Cobro vencido"]);
    expect(res[0].href).toBe("/proyectos/lerma-439/inversores/cuentas-corrientes/3b-x");
  });
});
