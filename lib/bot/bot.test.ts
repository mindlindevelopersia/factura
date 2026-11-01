import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Lo que el bot lee y escribe en la planilla, en memoria.
const tareas: Record<string, unknown>[] = [];
vi.mock("../tareas/fuente", () => ({
  leerTareas: async () => ({ tareas, comentarios: [] }),
  crearTarea: async (c: Record<string, unknown>, usuario: string, proyecto: string) => {
    const t = { id: `t${tareas.length + 1}`, descripcion: "", tipo: "Otro", estado: "Por hacer", prioridad: "Normal", responsable: "", vence: null, hora: "", relacion: "Interna", con: "", contactoId: "", bloqueadaPor: [], motivoBloqueo: "", subtareas: [], creo: usuario, creada: "", actualizada: "", terminada: null, ...c, proyecto };
    tareas.push(t);
    return t;
  },
  actualizarTarea: async () => null,
  comentar: async () => ({}),
}));
const avisos: unknown[] = [];
vi.mock("../notificaciones/fuente", () => ({ avisarAsignacion: async (a: unknown) => void avisos.push(a) }));
vi.mock("../crm/fuente", () => ({ leerCrm: async () => ({ contactos: [], actividad: [] }), crearContacto: async () => {}, actualizarContacto: async () => null }));
vi.mock("../finanzas/fuente", () => ({ unidadesDisponibles: async () => [], historicoMep: async () => ({ valor: [], leido: "" }) }));
vi.mock("../proyectos/propuestasFuente", () => ({ crearPropuesta: async () => ({}) }));

const { conversar } = await import("./agente");
const { ejecutar, HERRAMIENTAS } = await import("./herramientas");
const { recortar, turnoBot, vigente, leerTurnos, OLVIDA_MS } = await import("./historial");
const { contextoBot } = await import("./instrucciones");
const { tecladoDe } = await import("../telegram/api");
const { accesoDe } = await import("../permisos/modelo");

const todo = accesoDe("matimindlin111@gmail.com", undefined, true);
const ctx = { email: "matimindlin111@gmail.com", usuario: "Mati", acceso: todo, equipo: ["Mati", "Eliana"], appUrl: "https://hub.ejemplo", factura: null };

beforeEach(() => {
  tareas.length = 0;
  avisos.length = 0;
});

describe("bot de Telegram", () => {
  it("las herramientas tienen esquemas estrictos válidos (todos los campos, sin extras)", () => {
    const revisar = (s: Record<string, unknown>) => {
      if (s.type === "object") {
        expect(s.additionalProperties).toBe(false);
        expect([...(s.required as string[])].sort()).toEqual(Object.keys(s.properties as object).sort());
        for (const v of Object.values(s.properties as Record<string, Record<string, unknown>>)) revisar(v);
      }
    };
    for (const h of HERRAMIENTAS) {
      expect(h.strict).toBe(true);
      expect(h.description!.length).toBeGreaterThan(20);
      revisar(h.input_schema as Record<string, unknown>);
    }
    expect(new Set(HERRAMIENTAS.map((h) => h.name)).size).toBe(HERRAMIENTAS.length);
  });

  it("crear_tarea: la carga, avisa al responsable y pasa el link", async () => {
    const r = await ejecutar("crear_tarea", { titulo: "Llamar a la constructora", descripcion: "", responsable: "Eliana", vence: "2026-11-02", hora: null, prioridad: "Urgente", tipo: "Llamada", proyecto: "lerma-439", relacion: "Proveedor", con: "La constructora", subtareas: ["pedir remito"] }, ctx);
    expect(r.error).toBeFalsy();
    expect(tareas[0]).toMatchObject({ titulo: "Llamar a la constructora", responsable: "Eliana", vence: "2026-11-02", prioridad: "Urgente", creo: "Mati", proyecto: "lerma-439" });
    expect(JSON.parse(r.contenido).link).toBe("https://hub.ejemplo/proyectos/lerma-439/tareas?tarea=t1");
    expect(r.accion).toContain("t1");
    expect(avisos).toHaveLength(1);
  });

  it("respeta los permisos de quien escribe", async () => {
    const sinNada = { ...ctx, acceso: accesoDe("otra@ejemplo.com", undefined, false) };
    const r = await ejecutar("crear_tarea", { titulo: "x", descripcion: "", responsable: "", vence: null, hora: null, prioridad: "Normal", tipo: "Otro", proyecto: "lerma-439", relacion: "Interna", con: "", subtareas: [] }, sinNada);
    expect(r.error).toBe(true);
    expect(tareas).toHaveLength(0);
    expect((await ejecutar("nota_en_factura", { texto: "hola" }, ctx)).error).toBe(true);
  });

  it("ofrecer_opciones arma los botones", async () => {
    expect((await ejecutar("ofrecer_opciones", { opciones: ["Hoy", "Mañana", ""] }, ctx)).opciones).toEqual(["Hoy", "Mañana"]);
    expect(tecladoDe(["Hoy", "Mañana", "Sin fecha"])).toEqual([[{ text: "Hoy" }, { text: "Mañana" }], [{ text: "Sin fecha" }]]);
    expect(tecladoDe(["Una opción bastante larga", "Corta"])).toEqual([[{ text: "Una opción bastante larga" }], [{ text: "Corta" }]]);
  });

  it("el asistente: pregunta, después usa la herramienta y contesta con lo hecho", async () => {
    const pedidos: { messages: unknown[] }[] = [];
    const respuestas = [
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "u1", name: "crear_tarea", input: { titulo: "Comprar hormigón", descripcion: "", responsable: "Mati", vence: null, hora: null, prioridad: "Normal", tipo: "Otro", proyecto: "lerma-439", relacion: "Interna", con: "", subtareas: [] } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "✅ Listo, la cargué." }] },
    ];
    const client = { beta: { messages: { create: async (p: { messages: unknown[] }) => (pedidos.push(structuredClone(p)), respuestas.shift()) } } };
    const r = await conversar({ ctx, contexto: "Hoy es …", historial: [{ rol: "user", texto: "comprar hormigón" }, { rol: "assistant", texto: "¿Para cuándo?" }], mensaje: "sin fecha, mía", client: client as never });
    expect(r.texto).toBe("✅ Listo, la cargué.");
    expect(r.acciones[0]).toContain("Comprar hormigón");
    expect(tareas).toHaveLength(1);
    // La segunda vuelta lleva el pedido de la herramienta y su resultado.
    const segunda = pedidos[1].messages as { role: string; content: unknown }[];
    expect(segunda).toHaveLength(5);
    expect(segunda[4]).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "u1", is_error: false }] });
  });

  it("la memoria: se olvida a las 2 horas, recorta y siempre arranca por la persona", () => {
    const ahora = Date.parse("2026-11-01T12:00:00Z");
    expect(vigente("2026-11-01T11:00:00Z", ahora)).toBe(true);
    expect(vigente(new Date(ahora - OLVIDA_MS - 1).toISOString(), ahora)).toBe(false);
    const muchos = Array.from({ length: 30 }, (_, i) => ({ rol: (i % 2 ? "assistant" : "user") as "user" | "assistant", texto: `m${i}` }));
    const r = recortar(muchos);
    expect(r.length).toBeLessThanOrEqual(20);
    expect(r[0].rol).toBe("user");
    expect(turnoBot("Listo", ["creó la tarea t1"]).texto).toBe("Listo\n[Hecho: creó la tarea t1]");
    expect(leerTurnos("no es json")).toEqual([]);
  });

  it("el contexto dice el día, quién escribe y el equipo", () => {
    const c = contextoBot({ hoy: "2026-11-01", nombre: "Matías", usuario: "Mati", equipo: ["Mati", "Eliana"], appUrl: "https://hub", factura: null });
    expect(c).toContain("Hoy es domingo 2026-11-01");
    expect(c).toContain("@Mati");
    expect(c).toContain("Mati, Eliana");
    expect(c).toContain("lerma-439 (Lerma 439)");
  });
});
