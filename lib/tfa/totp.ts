/**
 * Códigos de 6 números que cambian cada 30 segundos (TOTP, RFC 6238), los de Google Authenticator
 * y apps parecidas. Puro, con el crypto de Node.
 */

import { createHmac, randomBytes } from "node:crypto";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const PASO_SEGUNDOS = 30;

export function base32(buf: Uint8Array): string {
  let bits = 0;
  let valor = 0;
  let s = "";
  for (const b of buf) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      s += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) s += ALFABETO[(valor << (5 - bits)) & 31];
  return s;
}

export function desdeBase32(s: string): Buffer {
  const limpio = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let valor = 0;
  const out: number[] = [];
  for (const c of limpio) {
    valor = (valor << 5) | ALFABETO.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Una clave nueva (160 bits, en base32), para dar de alta la app. */
export const nuevaClave = () => base32(randomBytes(20));

/** El código de un paso de 30 segundos. */
export function codigo(clave: string, paso: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const h = createHmac("sha1", desdeBase32(clave)).update(contador).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** Si el código vale ahora (acepta el paso anterior y el siguiente, por relojes desfasados). */
export function codigoValido(clave: string, ingresado: string, ahoraMs = Date.now()): boolean {
  const limpio = ingresado.replace(/\D/g, "");
  if (limpio.length !== 6) return false;
  const paso = Math.floor(ahoraMs / 1000 / PASO_SEGUNDOS);
  return [-1, 0, 1].some((d) => codigo(clave, paso + d) === limpio);
}

/** El link que lee la app (y el QR). */
export function linkApp(email: string, clave: string): string {
  const emisor = "Hub Mindlin";
  return `otpauth://totp/${encodeURIComponent(`${emisor}:${email}`)}?secret=${clave}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=6&period=${PASO_SEGUNDOS}`;
}

/** La clave de a cuatro letras, para tipearla a mano. */
export const claveLegible = (clave: string) => clave.match(/.{1,4}/g)!.join(" ");
