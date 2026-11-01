import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { exigir } from "@/lib/permisos/api";
import { prepararProducto } from "@/lib/producto/api";
import { volverAIdeas } from "@/lib/producto/fuente";

/** Vuelve un feature a Ideas: reabre la idea de la que salió (o crea una) y cancela el feature. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await prepararProducto("/producto/features");
  if (ctx instanceof NextResponse) return ctx;
  // Hace falta poder ver las dos partes.
  const puede = await exigir("/producto/ideas");
  if (puede instanceof NextResponse) return puede;
  const { id } = await params;
  try {
    const r = await volverAIdeas(id, ctx.usuario);
    if (!r) return NextResponse.json({ error: "No encontré ese feature." }, { status: 404 });
    return NextResponse.json(r);
  } catch (e) {
    return errorCrm(e, "producto features a-ideas");
  }
}
