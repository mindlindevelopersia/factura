import { describe, expect, it } from "vitest";
import { accesoDe, filaDeUsuario, PERMISOS, puede, puedeRuta, requisitoDeRuta, rolDe, SUPER_ADMIN, usuarioDeFila, validarConfig, type ConfigUsuario } from "./modelo";

const config = (c: Partial<ConfigUsuario>): ConfigUsuario => ({ email: "vendedor@ejemplo.com", nombre: "Persona", apellido: "Inventada", usuario: "persona", celular: "", horario: "", puesto: "", rol: "vendedor", claves: null, proyectos: null, actualizado: "", ...c });

describe("permisos", () => {
  it("las claves salen del menú", () => {
    const claves = PERMISOS.map((p) => p.clave);
    expect(claves).toEqual(expect.arrayContaining(["indicadores/cac", "calendario", "tareas", "comercial/crm", "finanzas/cash-flow", "inversores/cobranzas", "management/desarrolladores", "ajustes"]));
  });

  it("el super administrador ve todo, aunque la planilla diga otra cosa", () => {
    const a = accesoDe(SUPER_ADMIN, config({ email: SUPER_ADMIN, rol: "sin-rol" }), false);
    expect(a.superAdmin).toBe(true);
    expect(puedeRuta(a, "/ajustes")).toBe(true);
  });

  it("sin configurar: los del equipo entran como administradores; el resto, sin permisos", () => {
    expect(accesoDe("equipo@ejemplo.com", undefined, true).rol).toBe("admin");
    const nadie = accesoDe("otro@ejemplo.com", undefined, false);
    expect(nadie.claves).toEqual([]);
    expect(puedeRuta(nadie, "/")).toBe(true);
    expect(puedeRuta(nadie, "/proyectos/lerma-439/finanzas/cash-flow")).toBe(false);
  });

  it("un vendedor ve comercial pero no finanzas, ni ajustes, ni los indicadores", () => {
    const a = accesoDe("vendedor@ejemplo.com", config({}), false);
    expect(puedeRuta(a, "/proyectos/lerma-439/comercial/crm/embudo")).toBe(true);
    expect(puedeRuta(a, "/proyectos/lerma-439/comercial")).toBe(true);
    expect(puedeRuta(a, "/proyectos/lerma-439/finanzas")).toBe(false);
    expect(puedeRuta(a, "/proyectos/lerma-439/inversores/cuentas-corrientes/3b-x")).toBe(false);
    expect(puedeRuta(a, "/ajustes")).toBe(false);
    expect(puedeRuta(a, "/indicadores")).toBe(false);
    expect(puedeRuta(a, "/proyectos/lerma-439")).toBe(true);
  });

  it("los permisos a medida reemplazan los del rol, y los proyectos se pueden limitar", () => {
    const a = accesoDe("vendedor@ejemplo.com", config({ claves: ["finanzas/cash-flow"], proyectos: ["guemes-4676"] }), false);
    expect(puede(a, "finanzas/cash-flow", "guemes-4676")).toBe(true);
    expect(puede(a, "finanzas/cash-flow", "lerma-439")).toBe(false);
    expect(puede(a, "comercial/crm", "guemes-4676")).toBe(false);
    expect(puedeRuta(a, "/proyectos/lerma-439")).toBe(false);
  });

  it("nadie se vuelve super administrador desde la planilla", () => {
    expect(accesoDe("otro@ejemplo.com", config({ email: "otro@ejemplo.com", rol: "super" }), false)).toMatchObject({ superAdmin: false, rol: "admin" });
  });

  it("ida y vuelta por la fila de la planilla", () => {
    const c = config({ claves: ["tareas", "calendario"], proyectos: ["lerma-439"] });
    expect(usuarioDeFila(filaDeUsuario(c))).toEqual(c);
    expect(usuarioDeFila(["a@b.com"]).rol).toBe("sin-rol");
  });

  it("valida lo que llega de Ajustes", () => {
    const admin = accesoDe("admin@ejemplo.com", undefined, true);
    const ok = ["vendedor@ejemplo.com"];
    expect(validarConfig({ email: "nadie@ejemplo.com", rol: "vendedor" }, ok, admin)).toMatchObject({ error: expect.stringContaining("ALLOWED_EMAILS") });
    expect(validarConfig({ email: "vendedor@ejemplo.com", rol: "super" }, ok, admin)).toEqual({ error: "Elegí un rol." });
    expect(validarConfig({ email: SUPER_ADMIN, rol: "admin" }, [SUPER_ADMIN], admin)).toMatchObject({ error: expect.stringContaining("super administrador") });
    const v = validarConfig({ email: "Vendedor@ejemplo.com", rol: "vendedor", usuario: "@persona", claves: ["tareas", "inventada"] }, ok, admin);
    expect(v).toMatchObject({ config: { email: "vendedor@ejemplo.com", usuario: "persona", claves: ["tareas"] } });
    expect(requisitoDeRuta("/proyectos/lerma-439/comercial/propuesta?id=1")).toEqual({ clave: "comercial/propuesta", proyecto: "lerma-439" });
    expect(rolDe("inexistente").id).toBe("sin-rol");
  });
});
