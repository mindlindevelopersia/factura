import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { indiceDeDatos } from "@/lib/buscador/fuente";

/** Todo lo buscable de los datos (leads, propuestas, unidades, inversores, cobros, tareas). La pantalla filtra mientras escribís. */
export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  return NextResponse.json(await indiceDeDatos());
}
