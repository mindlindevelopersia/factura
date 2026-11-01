import "server-only";
import { NextResponse } from "next/server";
import { getUser } from "../auth/session";
import { persona } from "../equipo";
import { proyecto as buscarProyecto } from "../modulos";
import { CrmSinConfigurar } from "./fuente";

/** El usuario (con su apodo) y el proyecto, o la respuesta de error. */
export async function preparar(id: string): Promise<{ usuario: string; nombre: string; email: string; proyecto: { id: string; nombre: string } } | NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const p = buscarProyecto(id);
  if (!p || p.estado !== "activo") return NextResponse.json({ error: "Proyecto inexistente." }, { status: 404 });
  const quien = persona(user.email, user.name);
  return { usuario: quien.apodo, nombre: quien.nombre, email: user.email.toLowerCase(), proyecto: { id: p.id, nombre: p.nombre } };
}

export function errorCrm(e: unknown, donde: string) {
  console.error(donde, e);
  if (e instanceof CrmSinConfigurar) return NextResponse.json({ error: e.message }, { status: 503 });
  const status = (e as { response?: { status?: number } }).response?.status;
  if (status === 403) return NextResponse.json({ error: `La app no puede editar la planilla del CRM: compartila como Editor con ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "la cuenta de servicio"}.` }, { status: 502 });
  return NextResponse.json({ error: `No se pudo usar el CRM. ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
}
