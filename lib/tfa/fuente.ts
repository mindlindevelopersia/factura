import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { cifrar, descifrar } from "./cifrado";

/** Las claves de la verificación en dos pasos: pestaña "Segundo factor" de la planilla del CRM. */
const COLUMNAS = ["Email", "Clave (cifrada)", "Alta", "Último uso"] as const;

function pestania() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel) para guardar la verificación en dos pasos.");
  return new PestaniaSimple(client, sheet, "Segundo factor", COLUMNAS);
}

const secreto = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET.");
  return s;
};

async function buscar(email: string) {
  const t = pestania();
  const filas = await t.filas();
  const i = filas.findIndex((f) => (f[0] ?? "").toLowerCase() === email.toLowerCase() && f[1]);
  return { t, i, fila: i >= 0 ? filas[i] : null };
}

/** La clave de la app de esta persona, o null si todavía no la dio de alta (o hay que rehacerla). */
export async function claveDe(email: string): Promise<string | null> {
  const { fila } = await buscar(email);
  return fila ? descifrar(fila[1], secreto()) : null;
}

/** Guarda (o reemplaza) la clave de la app. */
export async function guardarClave(email: string, clave: string): Promise<void> {
  const { t, i } = await buscar(email);
  const ahora = new Date().toISOString();
  const fila = [email.toLowerCase(), cifrar(clave, secreto()), ahora, ahora];
  if (i >= 0) await t.escribir(i + 2, fila);
  else await t.agregar(fila);
}

export async function marcarUso(email: string): Promise<void> {
  const { t, i, fila } = await buscar(email);
  if (fila) await t.escribir(i + 2, [fila[0], fila[1], fila[2] ?? "", new Date().toISOString()]);
}

/** Borra la clave (la persona perdió el celular): en el próximo ingreso da de alta la app de nuevo. */
export async function reiniciar(email: string): Promise<boolean> {
  const { t, i, fila } = await buscar(email);
  if (!fila) return false;
  await t.escribir(i + 2, [fila[0], "", fila[2] ?? "", `reiniciada ${new Date().toISOString()}`]);
  return true;
}

/** Quiénes ya tienen la app dada de alta (para Ajustes). */
export async function conSegundoFactor(): Promise<string[]> {
  return (await pestania().filas()).filter((f) => f[0] && f[1]).map((f) => f[0].toLowerCase());
}
