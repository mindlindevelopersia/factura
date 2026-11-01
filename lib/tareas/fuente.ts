import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { nuevoId } from "../crm/modelo";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import {
  aplicarCambios,
  COLUMNAS_COMENTARIOS,
  COLUMNAS_TAREAS,
  comentarioDeFila,
  filaDeComentario,
  filaDeTarea,
  haceCirculo,
  nuevaTarea,
  tareaDeFila,
  type CambiosTarea,
  type Comentario,
  type Tarea,
} from "./modelo";

/** Las tareas viven en la planilla del CRM: pestañas "Tareas" y "Tareas Comentarios" (se crean solas). */
function pestanias() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Las tareas no se pueden guardar: falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return {
    tareas: new PestaniaSimple(client, sheet, "Tareas", COLUMNAS_TAREAS),
    comentarios: new PestaniaSimple(client, sheet, "Tareas Comentarios", COLUMNAS_COMENTARIOS),
  };
}

/** Todas las tareas (de todos los proyectos y las generales) y sus comentarios. */
export async function leerTareas(): Promise<{ tareas: Tarea[]; comentarios: Comentario[] }> {
  const p = pestanias();
  const [t, c] = await Promise.all([p.tareas.filas(), p.comentarios.filas()]);
  return {
    tareas: t.filter((f) => f[0]).map(tareaDeFila),
    comentarios: c.filter((f) => f[0]).map(comentarioDeFila),
  };
}

export class TareaInvalida extends Error {}

function revisarBloqueos(t: Tarea, todas: Tarea[]) {
  for (const b of t.bloqueadaPor) {
    if (!todas.some((x) => x.id === b)) throw new TareaInvalida("Una de las tareas que la bloquean ya no existe.");
    if (haceCirculo(t.id, b, todas)) throw new TareaInvalida("Eso arma un círculo: esa tarea ya está esperando a esta.");
  }
}

export async function crearTarea(cambios: CambiosTarea, usuario: string, proyecto: string): Promise<Tarea> {
  const p = pestanias();
  const ahora = new Date().toISOString();
  const t = nuevaTarea(nuevoId(), cambios, usuario, ahora, cambios.proyecto ?? proyecto);
  if (t.bloqueadaPor.length) revisarBloqueos(t, (await p.tareas.filas()).filter((f) => f[0]).map(tareaDeFila));
  await p.tareas.agregar(filaDeTarea(t));
  return t;
}

/** Cambia una tarea (busca su fila por ID). null si no está. */
export async function actualizarTarea(id: string, cambios: CambiosTarea): Promise<{ antes: Tarea; tarea: Tarea } | null> {
  const p = pestanias();
  const filas = await p.tareas.filas();
  const i = filas.findIndex((f) => f[0] === id);
  if (i < 0) return null;
  const todas = filas.filter((f) => f[0]).map(tareaDeFila);
  const antes = tareaDeFila(filas[i]);
  const t = aplicarCambios(antes, cambios, new Date().toISOString());
  if (cambios.bloqueadaPor) revisarBloqueos(t, todas);
  await p.tareas.escribir(i + 2, filaDeTarea(t));
  return { antes, tarea: t };
}

export async function comentar(tareaId: string, usuario: string, texto: string): Promise<Comentario> {
  const c: Comentario = { tareaId, fecha: new Date().toISOString(), usuario, texto };
  await pestanias().comentarios.agregar(filaDeComentario(c));
  return c;
}
