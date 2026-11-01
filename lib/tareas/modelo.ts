/**
 * Las tareas: un tablero tipo Trello para lo puntual (llamar a un inversor, pedirle algo a un
 * proveedor, una entrega, algo propio). Cada tarea tiene responsable, fecha, a quién se refiere,
 * descripción, subtareas, comentarios y qué la bloquea (otras tareas o un motivo).
 *
 * Una tarea está bloqueada mientras alguna de las que la bloquean siga abierta o tenga un motivo
 * escrito: en el tablero va a la columna "Bloqueada" y vuelve sola a la suya cuando se destraba.
 *
 * Se guardan en la planilla del CRM, pestañas "Tareas" y "Tareas Comentarios". Todo puro (sin red).
 */

export const ESTADOS = ["Por hacer", "En curso", "Hecha", "Cancelada"] as const;
export type EstadoTarea = (typeof ESTADOS)[number];

export const TIPOS = ["Llamada", "Seguimiento", "Visita", "Entrega", "Documentación", "Pago", "Otro"] as const;
export type TipoTarea = (typeof TIPOS)[number];

/** Con quién o con qué tiene que ver. */
export const RELACIONES = ["Interna", "Inversor", "Lead", "Proveedor", "Unidad"] as const;
export type Relacion = (typeof RELACIONES)[number];

export const PRIORIDADES = ["Normal", "Alta", "Urgente"] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

/** Las columnas del tablero ("Bloqueada" no es un estado: se calcula). */
export const COLUMNAS_TABLERO = ["Por hacer", "En curso", "Bloqueada", "Hecha"] as const;
export type ColumnaTablero = (typeof COLUMNAS_TABLERO)[number];

export interface Subtarea {
  texto: string;
  hecha: boolean;
}

export interface Tarea {
  id: string;
  /** El proyecto ("lerma-439"), o "" si es de la empresa en general. */
  proyecto: string;
  titulo: string;
  descripcion: string;
  tipo: TipoTarea;
  estado: EstadoTarea;
  prioridad: Prioridad;
  responsable: string;
  /** "2026-11-10". */
  vence: string | null;
  /** "15:30" (opcional). */
  hora: string;
  relacion: Relacion;
  /** El inversor, el proveedor, la unidad (texto libre) o el nombre del lead. */
  con: string;
  /** Si es un lead del CRM, su ID (para abrir la ficha). */
  contactoId: string;
  /** IDs de las tareas que la bloquean. */
  bloqueadaPor: string[];
  /** Otro motivo de bloqueo (algo que no es una tarea: "espera la firma del escribano"). */
  motivoBloqueo: string;
  subtareas: Subtarea[];
  creo: string;
  creada: string;
  actualizada: string;
  /** Cuándo se terminó (para ordenar las hechas). */
  terminada: string | null;
}

export interface Comentario {
  tareaId: string;
  fecha: string;
  usuario: string;
  texto: string;
}

export const COLUMNAS_TAREAS = [
  "ID",
  "Proyecto",
  "Título",
  "Descripción",
  "Tipo",
  "Estado",
  "Prioridad",
  "Responsable",
  "Vence",
  "Hora",
  "Relación",
  "Con",
  "ID contacto",
  "Bloqueada por",
  "Motivo de bloqueo",
  "Subtareas",
  "Creó",
  "Creada",
  "Actualizada",
  "Terminada",
] as const;

export const COLUMNAS_COMENTARIOS = ["ID tarea", "Fecha", "Usuario", "Comentario"] as const;

const de = <T extends string>(lista: readonly T[], v: unknown, otro: T): T => ((lista as readonly string[]).includes(String(v)) ? (v as T) : otro);

/** Las subtareas en una celda: una por renglón, "[x] " si está hecha. Se lee y se edita bien en la planilla. */
export const subtareasACelda = (s: Subtarea[]) => s.map((x) => `${x.hecha ? "[x]" : "[ ]"} ${x.texto}`).join("\n");
export const subtareasDeCelda = (t: string): Subtarea[] =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^\[( |x|X)\]\s*(.*)$/);
      return m ? { texto: m[2], hecha: m[1] !== " " } : { texto: l, hecha: false };
    })
    .filter((x) => x.texto);

export function filaDeTarea(t: Tarea): string[] {
  return [
    t.id,
    t.proyecto,
    t.titulo,
    t.descripcion,
    t.tipo,
    t.estado,
    t.prioridad,
    t.responsable,
    t.vence ?? "",
    t.hora,
    t.relacion,
    t.con,
    t.contactoId,
    t.bloqueadaPor.join(","),
    t.motivoBloqueo,
    subtareasACelda(t.subtareas),
    t.creo,
    t.creada,
    t.actualizada,
    t.terminada ?? "",
  ];
}

export function tareaDeFila(f: string[]): Tarea {
  const v = (i: number) => (f[i] ?? "").trim();
  return {
    id: v(0),
    proyecto: v(1),
    titulo: v(2),
    descripcion: f[3] ?? "",
    tipo: de(TIPOS, v(4), "Otro"),
    estado: de(ESTADOS, v(5), "Por hacer"),
    prioridad: de(PRIORIDADES, v(6), "Normal"),
    responsable: v(7),
    vence: /^\d{4}-\d{2}-\d{2}$/.test(v(8)) ? v(8) : null,
    hora: /^\d{1,2}:\d{2}$/.test(v(9)) ? v(9) : "",
    relacion: de(RELACIONES, v(10), "Interna"),
    con: v(11),
    contactoId: v(12),
    bloqueadaPor: v(13)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    motivoBloqueo: v(14),
    subtareas: subtareasDeCelda(f[15] ?? ""),
    creo: v(16),
    creada: v(17),
    actualizada: v(18) || v(17),
    terminada: v(19) || null,
  };
}

export const filaDeComentario = (c: Comentario) => [c.tareaId, c.fecha, c.usuario, c.texto];
export const comentarioDeFila = (f: string[]): Comentario => ({ tareaId: f[0] ?? "", fecha: f[1] ?? "", usuario: f[2] ?? "", texto: f[3] ?? "" });

export const abierta = (t: Pick<Tarea, "estado">) => t.estado === "Por hacer" || t.estado === "En curso";

/** Las tareas abiertas que la bloquean (las que no existen o ya se cerraron no cuentan). */
export function bloqueantes(t: Tarea, todas: Tarea[]): Tarea[] {
  return t.bloqueadaPor.map((id) => todas.find((x) => x.id === id)).filter((x): x is Tarea => !!x && abierta(x));
}

export function estaBloqueada(t: Tarea, todas: Tarea[]): boolean {
  return abierta(t) && (!!t.motivoBloqueo.trim() || bloqueantes(t, todas).length > 0);
}

/** Las tareas que esta bloquea. */
export const bloqueaA = (t: Tarea, todas: Tarea[]) => todas.filter((x) => x.bloqueadaPor.includes(t.id));

export function columnaDe(t: Tarea, todas: Tarea[]): ColumnaTablero | null {
  if (t.estado === "Cancelada") return null;
  if (estaBloqueada(t, todas)) return "Bloqueada";
  return t.estado as ColumnaTablero;
}

/** Si poner a `bloqueadora` como bloqueante de `tarea` arma un círculo (A espera a B y B espera a A). */
export function haceCirculo(tarea: string, bloqueadora: string, todas: Tarea[]): boolean {
  const pendientes = [bloqueadora];
  const vistas = new Set<string>();
  while (pendientes.length) {
    const id = pendientes.pop()!;
    if (id === tarea) return true;
    if (vistas.has(id)) continue;
    vistas.add(id);
    pendientes.push(...(todas.find((x) => x.id === id)?.bloqueadaPor ?? []));
  }
  return false;
}

export type CambiosTarea = Partial<Omit<Tarea, "id" | "creo" | "creada" | "actualizada" | "terminada">>;

/** Revisa los cambios que llegan del navegador: el error, o los cambios limpios. */
export function validarCambios(x: unknown, nueva: boolean): { error: string } | { cambios: CambiosTarea } {
  const o = (x ?? {}) as Record<string, unknown>;
  const c: CambiosTarea = {};
  const texto = (k: string, max: number) => (typeof o[k] === "string" ? (o[k] as string).slice(0, max) : undefined);
  const t = texto("titulo", 200);
  if (t !== undefined) c.titulo = t.trim();
  if (nueva && !c.titulo) return { error: "Falta qué hay que hacer." };
  if (t !== undefined && !c.titulo) return { error: "La tarea necesita un título." };
  const d = texto("descripcion", 5000);
  if (d !== undefined) c.descripcion = d;
  if (o.proyecto !== undefined) c.proyecto = String(o.proyecto).slice(0, 40);
  if (o.tipo !== undefined) c.tipo = de(TIPOS, o.tipo, "Otro");
  if (o.estado !== undefined) c.estado = de(ESTADOS, o.estado, "Por hacer");
  if (o.prioridad !== undefined) c.prioridad = de(PRIORIDADES, o.prioridad, "Normal");
  if (o.relacion !== undefined) c.relacion = de(RELACIONES, o.relacion, "Interna");
  for (const k of ["responsable", "con", "contactoId", "motivoBloqueo"] as const) {
    const v = texto(k, k === "motivoBloqueo" ? 300 : 120);
    if (v !== undefined) c[k] = v.trim();
  }
  if (o.vence !== undefined) {
    if (o.vence !== null && o.vence !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(String(o.vence))) return { error: "La fecha no es válida." };
    c.vence = o.vence ? String(o.vence) : null;
  }
  if (o.hora !== undefined) {
    if (o.hora && !/^\d{1,2}:\d{2}$/.test(String(o.hora))) return { error: "La hora no es válida." };
    c.hora = o.hora ? String(o.hora) : "";
  }
  if (o.bloqueadaPor !== undefined) {
    if (!Array.isArray(o.bloqueadaPor)) return { error: "Bloqueos inválidos." };
    c.bloqueadaPor = [...new Set(o.bloqueadaPor.map(String).filter(Boolean))].slice(0, 20);
  }
  if (o.subtareas !== undefined) {
    if (!Array.isArray(o.subtareas)) return { error: "Subtareas inválidas." };
    c.subtareas = o.subtareas
      .map((s) => ({ texto: String((s as Subtarea)?.texto ?? "").replace(/\s+/g, " ").trim().slice(0, 200), hecha: !!(s as Subtarea)?.hecha }))
      .filter((s) => s.texto)
      .slice(0, 50);
  }
  return { cambios: c };
}

/** Aplica los cambios: anota cuándo se terminó. */
export function aplicarCambios(t: Tarea, c: CambiosTarea, ahora: string): Tarea {
  const n: Tarea = { ...t, ...c, actualizada: ahora };
  if (c.estado && c.estado !== t.estado) n.terminada = c.estado === "Hecha" ? ahora : null;
  // Una tarea no se bloquea a sí misma.
  n.bloqueadaPor = n.bloqueadaPor.filter((x) => x !== n.id);
  return n;
}

export function nuevaTarea(id: string, c: CambiosTarea, usuario: string, ahora: string, proyecto: string): Tarea {
  return aplicarCambios(
    {
      id,
      proyecto,
      titulo: "",
      descripcion: "",
      tipo: "Otro",
      estado: "Por hacer",
      prioridad: "Normal",
      responsable: usuario,
      vence: null,
      hora: "",
      relacion: "Interna",
      con: "",
      contactoId: "",
      bloqueadaPor: [],
      motivoBloqueo: "",
      subtareas: [],
      creo: usuario,
      creada: ahora,
      actualizada: ahora,
      terminada: null,
    },
    c,
    ahora,
  );
}

/** Orden dentro de una columna: urgentes, después por fecha (sin fecha al final). Las hechas, las últimas terminadas primero. */
export function ordenar(a: Tarea, b: Tarea): number {
  if (a.estado === "Hecha" && b.estado === "Hecha") return (b.terminada ?? "").localeCompare(a.terminada ?? "");
  const p = PRIORIDADES.indexOf(b.prioridad) - PRIORIDADES.indexOf(a.prioridad);
  return p || (a.vence ?? "9999").localeCompare(b.vence ?? "9999") || a.creada.localeCompare(b.creada);
}
