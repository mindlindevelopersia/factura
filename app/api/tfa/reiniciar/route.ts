import { NextResponse } from "next/server";
import { exigir } from "@/lib/permisos/api";
import { conSegundoFactor, reiniciar } from "@/lib/tfa/fuente";

/** Quiénes ya tienen la app de códigos (para Ajustes). */
export async function GET() {
  const permiso = await exigir("/ajustes");
  if (permiso instanceof NextResponse) return permiso;
  try {
    return NextResponse.json({ emails: await conSegundoFactor() });
  } catch (e) {
    console.error("tfa estado", e);
    return NextResponse.json({ emails: null });
  }
}

/** Solo el super admin: borra la app de alguien (perdió el celular); en su próximo ingreso la da de alta de nuevo. */
export async function POST(req: Request) {
  const permiso = await exigir("/ajustes");
  if (permiso instanceof NextResponse) return permiso;
  if (!permiso.acceso.superAdmin) return NextResponse.json({ error: "Solo el super administrador puede reiniciar la verificación en dos pasos." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Falta el mail." }, { status: 400 });
  try {
    return NextResponse.json({ reiniciada: await reiniciar(email) });
  } catch (e) {
    console.error("tfa reiniciar", e);
    return NextResponse.json({ error: "No se pudo reiniciar. Probá de nuevo en un rato." }, { status: 503 });
  }
}
