/**
 * El navegador recordado después de la verificación en dos pasos: una cookie firmada (HMAC con
 * AUTH_SECRET) con el mail y hasta cuándo vale. Con Web Crypto, así sirve en el proxy. Puro.
 */

export const COOKIE_DISPOSITIVO = "hub-2fa";
/** La clave nueva mientras se da de alta la app (cifrada, 15 minutos). */
export const COOKIE_ALTA = "hub-2fa-alta";
/** Cuánto se recuerda el navegador si se tilda "recordar" (si no, lo que dura una sesión). */
export const DIAS_RECORDAR = 30;
export const HORAS_SIN_RECORDAR = 12;

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");

async function firma(texto: string, secreto: string): Promise<string> {
  const clave = await crypto.subtle.importKey("raw", enc.encode(`${secreto}:hub-2fa`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", clave, enc.encode(texto)));
}

/** El valor de la cookie: "mail.vence.firma". */
export async function firmarDispositivo(email: string, venceMs: number, secreto: string): Promise<string> {
  const cuerpo = `${b64url(enc.encode(email.toLowerCase()))}.${venceMs}`;
  return `${cuerpo}.${await firma(cuerpo, secreto)}`;
}

/** Si la cookie es de este mail, no venció y la firma es buena. */
export async function dispositivoValido(valor: string | undefined, email: string | null | undefined, secreto: string | undefined, ahoraMs = Date.now()): Promise<boolean> {
  if (!valor || !email || !secreto) return false;
  const partes = valor.split(".");
  if (partes.length !== 3) return false;
  const [mail64, vence, f] = partes;
  if (Buffer.from(mail64, "base64url").toString() !== email.toLowerCase()) return false;
  if (!(Number(vence) > ahoraMs)) return false;
  const esperada = await firma(`${mail64}.${vence}`, secreto);
  // Comparación de largo fijo (sin cortar en el primer carácter distinto).
  if (esperada.length !== f.length) return false;
  let dif = 0;
  for (let i = 0; i < f.length; i++) dif |= esperada.charCodeAt(i) ^ f.charCodeAt(i);
  return dif === 0;
}

/** Las rutas que se pueden usar con la sesión de Google pero sin el código (para pedirlo). */
export const SIN_SEGUNDO_FACTOR = (ruta: string) => ruta === "/verificar" || ruta.startsWith("/api/tfa/");

/** Interruptor de emergencia (en Vercel): TFA_DESACTIVADO=1 apaga la verificación para todos. */
export const tfaActivo = () => process.env.TFA_DESACTIVADO !== "1";
