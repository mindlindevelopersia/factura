import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { nuevoId } from "../crm/modelo";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { COLUMNAS_PROPUESTAS, filaDePropuesta, propuestaDeFila, type DatosPropuesta, type PropuestaGuardada } from "./propuestasGuardadas";

/** Las propuestas viven en la planilla del CRM, en la pestaña "Propuestas" (se crea sola). */
function pestania() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Las propuestas no se pueden guardar: falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return new PestaniaSimple(client, sheet, "Propuestas", COLUMNAS_PROPUESTAS);
}

/** Las del proyecto, de la más reciente a la más vieja. */
export async function leerPropuestas(proyecto: string): Promise<PropuestaGuardada[]> {
  const filas = await pestania().filas();
  return filas
    .filter((f) => f[0])
    .map(propuestaDeFila)
    .filter((p) => p.proyecto === proyecto)
    .sort((a, b) => b.actualizada.localeCompare(a.actualizada));
}

export async function crearPropuesta(proyecto: string, datos: DatosPropuesta, usuario: string): Promise<PropuestaGuardada> {
  const ahora = new Date().toISOString();
  const p: PropuestaGuardada = { id: nuevoId(), proyecto, creada: ahora, actualizada: ahora, autor: usuario, editor: usuario, ...datos };
  await pestania().agregar(filaDePropuesta(p));
  return p;
}

/** Guarda los cambios de una propuesta (busca su fila por ID). null si no está. */
export async function actualizarPropuesta(proyecto: string, id: string, datos: DatosPropuesta, usuario: string): Promise<PropuestaGuardada | null> {
  const t = pestania();
  const filas = await t.filas();
  const i = filas.findIndex((f) => f[0] === id);
  if (i < 0) return null;
  const antes = propuestaDeFila(filas[i]);
  if (antes.proyecto !== proyecto) return null;
  const p: PropuestaGuardada = { ...antes, ...datos, actualizada: new Date().toISOString(), editor: usuario };
  await t.escribir(i + 2, filaDePropuesta(p));
  return p;
}
