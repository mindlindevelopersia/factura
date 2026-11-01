import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { avisarAsignacion, avisarMenciones } from "@/lib/notificaciones/fuente";
import { prepararProducto } from "@/lib/producto/api";
import { actualizarTarea, leerTareas, TareaInvalida } from "@/lib/tareas/fuente";
import { PROYECTO_PRODUCTO, rutaDeTarea, validarCambios } from "@/lib/tareas/modelo";

/** Cambia un feature (solo de Producto: las tareas de los proyectos se cambian desde su tablero). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await prepararProducto("/producto/features");
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const v = validarCambios(await req.json().catch(() => null), false);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  delete v.cambios.proyecto;
  try {
    const actual = (await leerTareas()).tareas.find((t) => t.id === id);
    if (!actual || actual.proyecto !== PROYECTO_PRODUCTO) return NextResponse.json({ error: "No encontré ese feature." }, { status: 404 });
    const r = await actualizarTarea(id, v.cambios);
    if (!r) return NextResponse.json({ error: "No encontré ese feature." }, { status: 404 });
    const { antes, tarea } = r;
    const de = { de: ctx.usuario, deEmail: ctx.email, link: rutaDeTarea(tarea) };
    await Promise.all([
      avisarMenciones({ antes: `${antes.titulo}\n${antes.descripcion}`, texto: `${tarea.titulo}\n${tarea.descripcion}`, titulo: `Feature: ${tarea.titulo}`, ...de }),
      tarea.responsable && tarea.responsable !== antes.responsable ? avisarAsignacion({ apodo: tarea.responsable, titulo: `el feature ${tarea.titulo}`, texto: "Producto", ...de }) : null,
    ]);
    return NextResponse.json({ tarea });
  } catch (e) {
    if (e instanceof TareaInvalida) return NextResponse.json({ error: e.message }, { status: 400 });
    return errorCrm(e, "producto features PATCH");
  }
}
