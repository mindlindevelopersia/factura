/**
 * Las claves de la app de códigos se guardan cifradas (AES-256-GCM, con una clave que sale de
 * AUTH_SECRET): quien vea la planilla no puede generar códigos. Si AUTH_SECRET cambia, no se
 * pueden leer y cada uno vuelve a dar de alta su app.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const llave = (secreto: string) => createHash("sha256").update(`${secreto}:hub-2fa-clave`).digest();

export function cifrar(texto: string, secreto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", llave(secreto), iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), datos].map((b) => b.toString("base64url")).join(".");
}

/** null si no se puede (otro AUTH_SECRET, texto tocado). */
export function descifrar(valor: string, secreto: string): string | null {
  try {
    const [iv, tag, datos] = valor.split(".").map((x) => Buffer.from(x, "base64url"));
    const d = createDecipheriv("aes-256-gcm", llave(secreto), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(datos), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
