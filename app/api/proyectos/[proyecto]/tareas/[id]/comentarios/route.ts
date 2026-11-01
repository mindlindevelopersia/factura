import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { rutaProyecto } from "@/lib/modulos";
import { avisarMenciones, notificar, usuariosDelSistema } from "@/lib/notificaciones/fuente";
import { extracto, menciones, usuarioPorApodo, type Usuario } from "@/lib/notificaciones/modelo";
import { comentar, leerTareas } from "@/lib/tareas/fuente";

/** Un comentario en una tarea (lo puede dejar cualquiera del equipo). */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string; id: string }> }) {
  const { proyecto, id } = await params;
  const ctx = await preparar(proyecto, "tareas");
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { texto?: unknown };
  const texto = typeof body.texto === "string" ? body.texto.trim().slice(0, 3000) : "";
  if (!texto) return NextResponse.json({ error: "El comentario está vacío." }, { status: 400 });
  try {
    const comentario = await comentar(id, ctx.usuario, texto);
    // Avisos: a los mencionados, y al responsable y a quien la creó (si no los mencionaron ya).
    const tarea = (await leerTareas().catch(() => ({ tareas: [] }))).tareas.find((t) => t.id === id);
    if (tarea) {
      const link = `${rutaProyecto(tarea.proyecto || ctx.proyecto.id, "tareas")}?tarea=${tarea.id}`;
      const usuarios = await usuariosDelSistema();
      const mencionados = new Set(menciones(texto, usuarios).map((u) => u.email));
      const interesados = [tarea.responsable, tarea.creo].map((a) => usuarioPorApodo(a, usuarios)).filter((u): u is Usuario => !!u && !mencionados.has(u.email));
      await Promise.all([
        avisarMenciones({ texto, titulo: tarea.titulo, link, de: ctx.usuario, deEmail: ctx.email }),
        notificar([...new Map(interesados.map((u) => [u.email, u])).values()].map((u) => ({ para: u, tipo: "comentario" as const, titulo: `${ctx.usuario} comentó en: ${tarea.titulo}`, texto: extracto(texto), link, de: ctx.usuario, deEmail: ctx.email }))),
      ]);
    }
    return NextResponse.json({ comentario });
  } catch (e) {
    return errorCrm(e, "tareas comentario");
  }
}
