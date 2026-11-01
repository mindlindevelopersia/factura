import "server-only";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isAllowedEmail } from "../auth/allowed";
import { COOKIE_DISPOSITIVO, dispositivoValido, tfaActivo } from "./dispositivo";

/** El mail de la sesión de Google (habilitado), aunque todavía no haya puesto el código. */
export async function emailDeGoogle(): Promise<string | null> {
  const s = await auth();
  const email = s?.user?.email;
  return email && isAllowedEmail(email) ? email.toLowerCase() : null;
}

/** Si este navegador ya pasó la verificación en dos pasos para este mail (o está apagada). */
export async function segundoFactorOk(email: string): Promise<boolean> {
  if (!tfaActivo()) return true;
  return dispositivoValido((await cookies()).get(COOKIE_DISPOSITIVO)?.value, email, process.env.AUTH_SECRET);
}

/** Pocos intentos por persona (en este servidor): 5 errores en 10 minutos y espera. */
const errores = new Map<string, number[]>();
const VENTANA = 10 * 60 * 1000;
export function bloqueado(email: string, ahora = Date.now()): boolean {
  const l = (errores.get(email) ?? []).filter((t) => ahora - t < VENTANA);
  errores.set(email, l);
  return l.length >= 5;
}
export const contarError = (email: string) => errores.set(email, [...(errores.get(email) ?? []), Date.now()]);
export const limpiarErrores = (email: string) => errores.delete(email);
