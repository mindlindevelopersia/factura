import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { avisarMenciones, notificar, usuariosDelSistema } from "@/lib/notificaciones/fuente";
import { extracto, menciones, usuarioPorApodo } from "@/lib/notificaciones/modelo";
import { prepararProducto } from "@/lib/producto/api";
import { comentarIdea, leerIdeas } from "@/lib/producto/fuente";

/** Un comentario en una idea: avisa a los mencionados y a quien la escribió. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await prepararProducto("/producto/ideas");
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { texto?: unknown };
  const texto = typeof body.texto === "string" ? body.texto.trim().slice(0, 3000) : "";
  if (!texto) return NextResponse.json({ error: "El comentario está vacío." }, { status: 400 });
  try {
    const idea = (await leerIdeas()).ideas.find((i) => i.id === id);
    if (!idea) return NextResponse.json({ error: "No encontré esa idea." }, { status: 404 });
    const comentario = await comentarIdea(id, ctx.usuario, texto);
    const link = `/producto/ideas?idea=${id}`;
    const usuarios = await usuariosDelSistema();
    const autor = usuarioPorApodo(idea.autor, usuarios);
    const mencionado = autor && menciones(texto, usuarios).some((u) => u.email === autor.email);
    await Promise.all([
      avisarMenciones({ texto, titulo: `Idea: ${idea.titulo}`, link, de: ctx.usuario, deEmail: ctx.email }),
      autor && !mencionado ? notificar([{ para: autor, tipo: "comentario", titulo: `${ctx.usuario} comentó tu idea: ${idea.titulo}`, texto: extracto(texto), link, de: ctx.usuario, deEmail: ctx.email }]) : null,
    ]);
    return NextResponse.json({ comentario });
  } catch (e) {
    return errorCrm(e, "producto ideas comentario");
  }
}
