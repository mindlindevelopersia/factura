import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { cifrar } from "@/lib/tfa/cifrado";
import { COOKIE_ALTA } from "@/lib/tfa/dispositivo";
import { claveDe } from "@/lib/tfa/fuente";
import { emailDeGoogle } from "@/lib/tfa/sesion";
import { claveLegible, linkApp, nuevaClave } from "@/lib/tfa/totp";

/**
 * Empieza el alta de la app de códigos: una clave nueva (queda en una cookie cifrada por 15
 * minutos, hasta que se confirme con un código) y su QR. Si ya tiene la app, no hace nada.
 */
export async function POST() {
  const email = await emailDeGoogle();
  if (!email) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  try {
    if (await claveDe(email)) return NextResponse.json({ yaTiene: true });
    const clave = nuevaClave();
    const link = linkApp(email, clave);
    const res = NextResponse.json({ qr: await QRCode.toDataURL(link, { margin: 1, width: 220 }), clave: claveLegible(clave), link });
    res.cookies.set(COOKIE_ALTA, cifrar(`${email}|${clave}`, process.env.AUTH_SECRET!), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/tfa", maxAge: 15 * 60 });
    return res;
  } catch (e) {
    console.error("tfa alta", e);
    return NextResponse.json({ error: "No se pudo preparar la verificación. Probá de nuevo en un rato." }, { status: 503 });
  }
}
