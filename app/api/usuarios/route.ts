import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { usuariosDelSistema } from "@/lib/notificaciones/fuente";

/** Los usuarios del sistema, para mencionarlos con @. */
export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  return NextResponse.json({ usuarios: (await usuariosDelSistema()).map(({ apodo, nombre }) => ({ apodo, nombre })) });
}
