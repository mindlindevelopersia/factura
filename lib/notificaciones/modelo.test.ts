import { describe, expect, it } from "vitest";
import { contactoDeFila } from "../crm/modelo";
import { nuevaTarea } from "../tareas/modelo";
import { combinar, filaDeNotificacion, filaLeida, leerFilas, menciones, mencionesNuevas, usuarioPorApodo, vencimientosDe, type Usuario } from "./modelo";

const usuarios: Usuario[] = [
  { email: "uno@ejemplo.com", apodo: "Mati", nombre: "Persona Uno" },
  { email: "dos@ejemplo.com", apodo: "Tade", nombre: "Persona Dos" },
  { email: "eliana.inventada@ejemplo.com", apodo: "eliana.inventada", nombre: "eliana.inventada" },
];

describe("notificaciones", () => {
  it("encuentra las menciones (sin tildes ni mayúsculas, también por el mail)", () => {
    expect(menciones("Hola @tade, mirá esto con @Eliana.Inventada.", usuarios).map((u) => u.apodo)).toEqual(["Tade", "eliana.inventada"]);
    expect(menciones("mail: alguien@tade.com", usuarios)).toEqual([]);
    expect(menciones("@Nadie", usuarios)).toEqual([]);
  });

  it("al editar, solo avisa a los mencionados nuevos", () => {
    expect(mencionesNuevas("@Mati fijate", "@Mati fijate y @Tade también", usuarios).map((u) => u.apodo)).toEqual(["Tade"]);
    expect(usuarioPorApodo("mati", usuarios)?.email).toBe("uno@ejemplo.com");
  });

  it("guarda, lee y marca como leídas", () => {
    const n = { id: "n1", para: "uno@ejemplo.com", fecha: "2026-11-01T10:00:00.000Z", tipo: "mencion" as const, titulo: "Tade te mencionó", texto: "hola", link: "/x", de: "Tade" };
    const filas = [filaDeNotificacion(n), filaDeNotificacion({ ...n, id: "n2", para: "dos@ejemplo.com" }), filaLeida("venc-1", "uno@ejemplo.com", "2026-11-01")];
    const { guardadas, leidas } = leerFilas(filas, "UNO@ejemplo.com");
    expect(guardadas.map((x) => x.id)).toEqual(["n1"]);
    const todas = combinar(guardadas, [{ ...n, id: "venc-1", tipo: "vencimiento", fecha: "2026-11-02T00:00:00.000Z", leida: false }], leidas);
    expect(todas.map((x) => [x.id, x.leida])).toEqual([
      ["venc-1", true],
      ["n1", false],
    ]);
  });

  it("vencimientos: tus tareas y leads de hoy, mañana y atrasados", () => {
    const ahora = "2026-11-01T10:00:00.000Z";
    const tareas = [
      nuevaTarea("a", { titulo: "Hoy", vence: "2026-11-01", responsable: "Mati" }, "Mati", ahora, "lerma-439"),
      nuevaTarea("b", { titulo: "Mañana", vence: "2026-11-02", responsable: "Mati" }, "Mati", ahora, "lerma-439"),
      nuevaTarea("c", { titulo: "En una semana", vence: "2026-11-08", responsable: "Mati" }, "Mati", ahora, "lerma-439"),
      nuevaTarea("d", { titulo: "De otro", vence: "2026-11-01", responsable: "Tade" }, "Mati", ahora, "lerma-439"),
      nuevaTarea("e", { titulo: "Hecha", vence: "2026-11-01", responsable: "Mati", estado: "Hecha" }, "Mati", ahora, "lerma-439"),
    ];
    const contactos = [{ ...contactoDeFila(["c1", "", "Lead Inventado"]), etapa: "Interesado" as const, proximaFecha: "2026-10-30", responsable: "Mati", proyectos: ["lerma-439"] }];
    const v = vencimientosDe("mati", { tareas, contactos, agenda: [], propuestas: [] }, "2026-11-01");
    expect(v.map((x) => x.titulo)).toEqual(["Tarea: Hoy", "Tarea: Mañana", "Hablar con Lead Inventado"]);
    expect(v[0].texto).toContain("vence hoy");
    expect(v[2]).toMatchObject({ link: "/proyectos/lerma-439/comercial/crm?contacto=c1" });
  });
});
