import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { nuevoId } from "../crm/modelo";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { COLUMNAS_COMENTARIOS_DATOS, comentarioDatoDeFila, filaDeComentarioDato, rutaBase, type ComentarioDato } from "./modelo";

function pestania() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Los comentarios no se pueden guardar: falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return new PestaniaSimple(client, sheet, "Comentarios en datos", COLUMNAS_COMENTARIOS_DATOS);
}

/** Los comentarios de una página (y, si se dice, solo los de las claves que empiezan así). */
export async function leerComentariosDatos(ruta: string, prefijo = ""): Promise<ComentarioDato[]> {
  const r = rutaBase(ruta);
  return (await pestania().filas())
    .filter((f) => f[0])
    .map(comentarioDatoDeFila)
    .filter((c) => rutaBase(c.ruta) === r && c.clave.startsWith(prefijo));
}

export async function comentarDato(datos: Omit<ComentarioDato, "id" | "fecha" | "usuario">, usuario: string): Promise<ComentarioDato> {
  const c: ComentarioDato = { ...datos, id: nuevoId(), fecha: new Date().toISOString(), usuario };
  await pestania().agregar(filaDeComentarioDato(c));
  return c;
}
