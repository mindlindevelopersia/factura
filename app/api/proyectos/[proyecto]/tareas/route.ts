import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { leerCrm } from "@/lib/crm/fuente";
import { EQUIPO_APODOS } from "@/lib/equipo";
import { crearTarea, leerTareas, TareaInvalida } from "@/lib/tareas/fuente";
import { validarCambios } from "@/lib/tareas/modelo";

/** Todas las tareas con sus comentarios (la pantalla filtra por proyecto), el equipo y los leads para vincular. */
export async function GET(_req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto);
  if (ctx instanceof NextResponse) return ctx;
  try {
    const [t, crm] = await Promise.all([leerTareas(), leerCrm().catch(() => ({ contactos: [] }))]);
    const leads = crm.contactos.map((c) => ({ id: c.id, nombre: c.nombre }));
    return NextResponse.json({ ...t, usuario: ctx.usuario, equipo: [...new Set([...EQUIPO_APODOS, ctx.usuario])], leads, ahora: new Date().toISOString() });
  } catch (e) {
    return errorCrm(e, "tareas GET");
  }
}

/** Una tarea nueva. */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto);
  if (ctx instanceof NextResponse) return ctx;
  const v = validarCambios(await req.json().catch(() => null), true);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    return NextResponse.json({ tarea: await crearTarea(v.cambios, ctx.usuario, ctx.proyecto.id) });
  } catch (e) {
    if (e instanceof TareaInvalida) return NextResponse.json({ error: e.message }, { status: 400 });
    return errorCrm(e, "tareas POST");
  }
}
