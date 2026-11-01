import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { rutaProyecto } from "@/lib/modulos";
import { avisarAsignacion, avisarMenciones } from "@/lib/notificaciones/fuente";
import { actualizarTarea, TareaInvalida } from "@/lib/tareas/fuente";
import { validarCambios } from "@/lib/tareas/modelo";

/** Cambia una tarea (estado, responsable, fecha, subtareas, bloqueos…). */
export async function PATCH(req: Request, { params }: { params: Promise<{ proyecto: string; id: string }> }) {
  const { proyecto, id } = await params;
  const ctx = await preparar(proyecto);
  if (ctx instanceof NextResponse) return ctx;
  const v = validarCambios(await req.json().catch(() => null), false);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const r = await actualizarTarea(id, v.cambios);
    if (!r) return NextResponse.json({ error: "No encontré esa tarea." }, { status: 404 });
    const { antes, tarea } = r;
    const link = `${rutaProyecto(tarea.proyecto || ctx.proyecto.id, "tareas")}?tarea=${tarea.id}`;
    const de = { de: ctx.usuario, deEmail: ctx.email };
    await Promise.all([
      avisarMenciones({ antes: `${antes.titulo}\n${antes.descripcion}`, texto: `${tarea.titulo}\n${tarea.descripcion}`, titulo: tarea.titulo, link, ...de }),
      tarea.responsable && tarea.responsable !== antes.responsable ? avisarAsignacion({ apodo: tarea.responsable, titulo: tarea.titulo, texto: tarea.vence ? `Vence el ${tarea.vence.split("-").reverse().join("/")}` : "Te la pasaron", link, ...de }) : null,
    ]);
    return NextResponse.json({ tarea });
  } catch (e) {
    if (e instanceof TareaInvalida) return NextResponse.json({ error: e.message }, { status: 400 });
    return errorCrm(e, "tareas PATCH");
  }
}
