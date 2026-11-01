import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { CrmSinConfigurar } from "@/lib/crm/fuente";
import { notificacionesDe } from "@/lib/notificaciones/fuente";

/** Las notificaciones del usuario: menciones, asignaciones, comentarios y sus vencimientos. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  try {
    return NextResponse.json({ notificaciones: await notificacionesDe(user.email) });
  } catch (e) {
    console.error("notificaciones", e);
    return NextResponse.json({ error: e instanceof CrmSinConfigurar ? e.message : "No se pudieron leer las notificaciones." }, { status: e instanceof CrmSinConfigurar ? 503 : 502 });
  }
}
