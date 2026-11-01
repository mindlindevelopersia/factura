import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { proyecto as buscarProyecto } from "@/lib/modulos";

const TIPOS: Record<string, string> = { png: "image/png", jpg: "image/jpeg" };

/**
 * Los planos, renders y logos de un proyecto (para las propuestas). Viven en privado/proyectos/<id>/,
 * no en public/: solo los ve quien inició sesión.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ proyecto: string; archivo: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  const { proyecto, archivo } = await params;
  const m = archivo.match(/^[a-z0-9-]+\.(png|jpg)$/);
  if (!buscarProyecto(proyecto) || !m) return NextResponse.json({ error: "No existe." }, { status: 404 });
  try {
    const datos = await readFile(path.join(process.cwd(), "privado", "proyectos", proyecto, archivo));
    return new Response(new Uint8Array(datos), { headers: { "content-type": TIPOS[m[1]], "cache-control": "private, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "No existe." }, { status: 404 });
  }
}
