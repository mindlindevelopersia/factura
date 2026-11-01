import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { nuevoId } from "../crm/modelo";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
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
