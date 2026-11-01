import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { comentar } from "@/lib/tareas/fuente";

/** Un comentario en una tarea (lo puede dejar cualquiera del equipo). */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string; id: string }> }) {
  const { proyecto, id } = await params;
  const ctx = await preparar(proyecto);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { texto?: unknown };
  const texto = typeof body.texto === "string" ? body.texto.trim().slice(0, 3000) : "";
  if (!texto) return NextResponse.json({ error: "El comentario está vacío." }, { status: 400 });
  try {
    return NextResponse.json({ comentario: await comentar(id, ctx.usuario, texto) });
  } catch (e) {
    return errorCrm(e, "tareas comentario");
  }
}
