import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { avisarMenciones } from "@/lib/notificaciones/fuente";
import { prepararProducto } from "@/lib/producto/api";
import { crearIdea, leerIdeas } from "@/lib/producto/fuente";
import { ordenarIdeas, validarIdea } from "@/lib/producto/ideas";

/** El tablero de ideas, de la última actividad a la más vieja. */
export async function GET() {
  const ctx = await prepararProducto("/producto/ideas");
  if (ctx instanceof NextResponse) return ctx;
  try {
    const { ideas, comentarios } = await leerIdeas();
    return NextResponse.json({ ideas: ordenarIdeas(ideas, comentarios), comentarios, usuario: ctx.usuario });
  } catch (e) {
    return errorCrm(e, "producto ideas GET");
  }
}

/** Una idea nueva. */
export async function POST(req: Request) {
  const ctx = await prepararProducto("/producto/ideas");
  if (ctx instanceof NextResponse) return ctx;
  const v = validarIdea(await req.json().catch(() => null), true);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const idea = await crearIdea(v.cambios.titulo!, v.cambios.texto ?? "", ctx.usuario, v.cambios.tags ?? []);
    await avisarMenciones({ texto: `${idea.titulo}\n${idea.texto}`, titulo: `Idea: ${idea.titulo}`, link: `/producto/ideas?idea=${idea.id}`, de: ctx.usuario, deEmail: ctx.email });
    return NextResponse.json({ idea });
  } catch (e) {
    return errorCrm(e, "producto ideas POST");
  }
}
