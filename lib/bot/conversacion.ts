import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { cifrar, descifrar } from "../tfa/cifrado";
import { leerTurnos, recortar, vigente, type Turno } from "./historial";

/**
 * La conversación de cada chat con el bot: pestaña "Bot Telegram" de la planilla del CRM.
 * Cifrada (AES-256-GCM, con una llave que sale de AUTH_SECRET): quien abra la planilla no puede
 * leer lo que cada uno habló con el bot.
 */
const COLUMNAS = ["Chat", "Email", "Actualizada", "Conversación (cifrada)"] as const;

const secreto = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET.");
  return `${s}:bot-telegram`;
};

function pestania() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return new PestaniaSimple(client, sheet, "Bot Telegram", COLUMNAS);
}

/** Lo que se viene hablando en este chat (vacío si pasó mucho tiempo). */
export async function leerConversacion(chat: number): Promise<Turno[]> {
  const fila = (await pestania().filas()).find((f) => f[0] === String(chat));
  if (!fila || !vigente(fila[2], Date.now())) return [];
  // Si no se puede descifrar (otro AUTH_SECRET, o una charla de antes del cifrado), arranca de cero.
  return leerTurnos(descifrar(fila[3] ?? "", secreto()) ?? "[]");
}

export async function guardarConversacion(chat: number, email: string, turnos: Turno[]): Promise<void> {
  const t = pestania();
  const filas = await t.filas();
  const i = filas.findIndex((f) => f[0] === String(chat));
  const fila = [String(chat), email, new Date().toISOString(), cifrar(JSON.stringify(recortar(turnos)), secreto())];
  if (i >= 0) await t.escribir(i + 2, fila);
  else await t.agregar(fila);
}
