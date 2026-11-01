import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { descifrar } from "@/lib/tfa/cifrado";
import { COOKIE_ALTA, COOKIE_DISPOSITIVO, DIAS_RECORDAR, firmarDispositivo, HORAS_SIN_RECORDAR } from "@/lib/tfa/dispositivo";
import { claveDe, guardarClave, marcarUso } from "@/lib/tfa/fuente";
import { bloqueado, contarError, emailDeGoogle, limpiarErrores } from "@/lib/tfa/sesion";
import { codigoValido } from "@/lib/tfa/totp";

/** Revisa el código de 6 números. Si es el alta, guarda la clave. Si está bien, recuerda este navegador. */
export async function POST(req: Request) {
  const email = await emailDeGoogle();
  if (!email) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  if (bloqueado(email)) return NextResponse.json({ error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { codigo?: unknown; recordar?: unknown } | null;
  const codigo = typeof body?.codigo === "string" ? body.codigo : "";
  const secreto = process.env.AUTH_SECRET!;
  try {
    let clave = await claveDe(email);
    let alta = false;
    if (!clave) {
      const enAlta = descifrar((await cookies()).get(COOKIE_ALTA)?.value ?? "", secreto);
      const [mail, c] = (enAlta ?? "").split("|");
      if (mail !== email || !c) return NextResponse.json({ error: "Primero escaneá el código QR (o recargá la página para generar uno nuevo)." }, { status: 400 });
      clave = c;
      alta = true;
    }
    if (!codigoValido(clave, codigo)) {
      contarError(email);
      return NextResponse.json({ error: "El código no es correcto. Fijate que sea el de \"Hub Mindlin\" y que no haya cambiado." }, { status: 400 });
    }
    limpiarErrores(email);
    if (alta) await guardarClave(email, clave);
    else await marcarUso(email).catch((e) => console.error("tfa uso", e));
    const recordar = body?.recordar !== false;
    const segundos = recordar ? DIAS_RECORDAR * 24 * 3600 : HORAS_SIN_RECORDAR * 3600;
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_DISPOSITIVO, await firmarDispositivo(email, Date.now() + segundos * 1000, secreto), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: segundos });
    if (alta) res.cookies.set(COOKIE_ALTA, "", { path: "/api/tfa", maxAge: 0 });
    return res;
  } catch (e) {
    console.error("tfa verificar", e);
    return NextResponse.json({ error: "No se pudo verificar. Probá de nuevo en un rato." }, { status: 503 });
  }
}
