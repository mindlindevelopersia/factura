import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { EQUIPO_APODOS } from "@/lib/equipo";
import { avisarAsignacion, avisarMenciones } from "@/lib/notificaciones/fuente";
import { prepararProducto } from "@/lib/producto/api";
import { crearTarea, leerTareas, TareaInvalida } from "@/lib/tareas/fuente";
import { PROYECTO_PRODUCTO, rutaDeTarea, validarCambios } from "@/lib/tareas/modelo";

/** Los features de Producto (tareas con proyecto "producto") y sus comentarios. */
export async function GET() {
  const ctx = await prepararProducto("/producto/features");
  if (ctx instanceof NextResponse) return ctx;
  try {
    const t = await leerTareas();
    const tareas = t.tareas.filter((x) => x.proyecto === PROYECTO_PRODUCTO);
    const ids = new Set(tareas.map((x) => x.id));
    return NextResponse.json({ tareas, comentarios: t.comentarios.filter((c) => ids.has(c.tareaId)), usuario: ctx.usuario, equipo: [...new Set([...EQUIPO_APODOS, ctx.usuario])], leads: [], ahora: new Date().toISOString() });
  } catch (e) {
    return errorCrm(e, "producto features GET");
  }
}

/** Un feature nuevo. */
export async function POST(req: Request) {
  const ctx = await prepararProducto("/producto/features");
  if (ctx instanceof NextResponse) return ctx;
  const v = validarCambios(await req.json().catch(() => null), true);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const tarea = await crearTarea({ ...v.cambios, proyecto: PROYECTO_PRODUCTO }, ctx.usuario, PROYECTO_PRODUCTO);
    const de = { de: ctx.usuario, deEmail: ctx.email, link: rutaDeTarea(tarea) };
    await Promise.all([
      avisarMenciones({ texto: `${tarea.titulo}\n${tarea.descripcion}`, titulo: `Feature: ${tarea.titulo}`, ...de }),
      tarea.responsable ? avisarAsignacion({ apodo: tarea.responsable, titulo: `el feature ${tarea.titulo}`, texto: "Producto", ...de }) : null,
    ]);
    return NextResponse.json({ tarea });
  } catch (e) {
    if (e instanceof TareaInvalida) return NextResponse.json({ error: e.message }, { status: 400 });
    return errorCrm(e, "producto features POST");
  }
}
