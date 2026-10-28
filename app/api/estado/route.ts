import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { chequearConfiguracion } from "@/lib/estado";

/** Qué está configurado y qué falta, para la pantalla de estado. No cambia nada. */
export async function GET(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  return NextResponse.json(await chequearConfiguracion(new URL(req.url).origin));
}
