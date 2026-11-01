import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { nuevoId } from "../crm/modelo";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { actualizarTarea, leerTareas } from "../tareas/fuente";
import { PROYECTO_PRODUCTO } from "../tareas/modelo";
import { COLUMNAS_COMENTARIOS_IDEAS, COLUMNAS_IDEAS, comentarioIdeaDeFila, filaDeComentarioIdea, filaDeIdea, ideaDeFila, type ComentarioIdea, type Idea } from "./ideas";

function pestanias() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Las ideas no se pueden guardar: falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return {
    ideas: new PestaniaSimple(client, sheet, "Producto Ideas", COLUMNAS_IDEAS),
    comentarios: new PestaniaSimple(client, sheet, "Producto Comentarios", COLUMNAS_COMENTARIOS_IDEAS),
  };
}

export async function leerIdeas(): Promise<{ ideas: Idea[]; comentarios: ComentarioIdea[] }> {
  const p = pestanias();
  const [i, c] = await Promise.all([p.ideas.filas(), p.comentarios.filas()]);
  return { ideas: i.filter((f) => f[0]).map(ideaDeFila), comentarios: c.filter((f) => f[0]).map(comentarioIdeaDeFila) };
}

export async function crearIdea(titulo: string, texto: string, autor: string): Promise<Idea> {
  const ahora = new Date().toISOString();
  const idea: Idea = { id: nuevoId(), titulo, texto, autor, creada: ahora, actualizada: ahora, estado: "Abierta", featureId: "" };
  await pestanias().ideas.agregar(filaDeIdea(idea));
  return idea;
}

/** Cambia una idea (busca su fila por ID). Devuelve cómo estaba y cómo quedó, o null. */
export async function actualizarIdea(id: string, cambios: Partial<Idea>): Promise<{ antes: Idea; idea: Idea } | null> {
  const t = pestanias().ideas;
  const filas = await t.filas();
  const i = filas.findIndex((f) => f[0] === id);
  if (i < 0) return null;
  const antes = ideaDeFila(filas[i]);
  const idea: Idea = { ...antes, ...cambios, id, actualizada: new Date().toISOString() };
  await t.escribir(i + 2, filaDeIdea(idea));
  return { antes, idea };
}

export async function comentarIdea(ideaId: string, usuario: string, texto: string): Promise<ComentarioIdea> {
  const c: ComentarioIdea = { ideaId, fecha: new Date().toISOString(), usuario, texto };
  await pestanias().comentarios.agregar(filaDeComentarioIdea(c));
  return c;
}

/**
 * Un feature vuelve a Ideas: si salió de una idea, esa idea se reabre (sin feature); si se creó
 * directo en Features, se arma una idea nueva con su título y descripción. El feature queda
 * "Cancelado" (sale del tablero, pero no se borra: conserva sus comentarios). Deja un comentario
 * en la idea con quién la volvió. null si el feature no existe o no es de Producto.
 */
export async function volverAIdeas(featureId: string, usuario: string): Promise<{ idea: Idea } | null> {
  const feature = (await leerTareas()).tareas.find((t) => t.id === featureId && t.proyecto === PROYECTO_PRODUCTO);
  if (!feature) return null;
  const vinculada = (await leerIdeas()).ideas.find((i) => i.featureId === featureId);
  let idea: Idea;
  if (vinculada) {
    const r = await actualizarIdea(vinculada.id, { estado: "Abierta", featureId: "" });
    idea = r!.idea;
  } else {
    const texto = feature.descripcion.replace(/\n*\(De la idea de [^)]*\)\s*$/, "").trim();
    idea = await crearIdea(feature.titulo, texto, feature.creo || usuario);
  }
  await actualizarTarea(featureId, { estado: "Cancelada" });
  await comentarIdea(idea.id, usuario, `Volvió de Features (el feature "${feature.titulo}" quedó cancelado).`);
  return { idea };
}
