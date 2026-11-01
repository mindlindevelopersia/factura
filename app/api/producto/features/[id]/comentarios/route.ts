import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { avisarMenciones, notificar, usuariosDelSistema } from "@/lib/notificaciones/fuente";
import { extracto, menciones, usuarioPorApodo, type Usuario } from "@/lib/notificaciones/modelo";
import { prepararProducto } from "@/lib/producto/api";
import { comentar, leerTareas } from "@/lib/tareas/fuente";
import { PROYECTO_PRODUCTO, rutaDeTarea } from "@/lib/tareas/modelo";

/** Un comentario en un feature. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await prepararProducto("/producto/features");
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { texto?: unknown };
  const texto = typeof body.texto === "string" ? body.texto.trim().slice(0, 3000) : "";
  if (!texto) return NextResponse.json({ error: "El comentario está vacío." }, { status: 400 });
  try {
    const tarea = (await leerTareas()).tareas.find((t) => t.id === id);
    if (!tarea || tarea.proyecto !== PROYECTO_PRODUCTO) return NextResponse.json({ error: "No encontré ese feature." }, { status: 404 });
    const comentario = await comentar(id, ctx.usuario, texto);
    const link = rutaDeTarea(tarea);
    const usuarios = await usuariosDelSistema();
    const mencionados = new Set(menciones(texto, usuarios).map((u) => u.email));
    const interesados = [tarea.responsable, tarea.creo].map((a) => usuarioPorApodo(a, usuarios)).filter((u): u is Usuario => !!u && !mencionados.has(u.email));
    await Promise.all([
      avisarMenciones({ texto, titulo: `Feature: ${tarea.titulo}`, link, de: ctx.usuario, deEmail: ctx.email }),
      notificar([...new Map(interesados.map((u) => [u.email, u])).values()].map((u) => ({ para: u, tipo: "comentario" as const, titulo: `${ctx.usuario} comentó en: ${tarea.titulo}`, texto: extracto(texto), link, de: ctx.usuario, deEmail: ctx.email }))),
    ]);
    return NextResponse.json({ comentario });
  } catch (e) {
    return errorCrm(e, "producto features comentario");
  }
}
