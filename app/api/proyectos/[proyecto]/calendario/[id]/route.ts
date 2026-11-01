import { NextResponse } from "next/server";
import { borrarAgenda } from "@/lib/calendario/fuente";
import { errorCrm, preparar } from "@/lib/crm/api";

/** Borra un evento cargado a mano. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ proyecto: string; id: string }> }) {
  const { proyecto, id } = await params;
  const ctx = await preparar(proyecto, "calendario");
  if (ctx instanceof NextResponse) return ctx;
  try {
    if (!(await borrarAgenda(ctx.proyecto.id, id))) return NextResponse.json({ error: "No encontré ese evento." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorCrm(e, "calendario DELETE");
  }
}
