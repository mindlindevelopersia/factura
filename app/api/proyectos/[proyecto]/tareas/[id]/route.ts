import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
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
    const t = await actualizarTarea(id, v.cambios);
    if (!t) return NextResponse.json({ error: "No encontré esa tarea." }, { status: 404 });
    return NextResponse.json({ tarea: t });
  } catch (e) {
    if (e instanceof TareaInvalida) return NextResponse.json({ error: e.message }, { status: 400 });
    return errorCrm(e, "tareas PATCH");
  }
}
