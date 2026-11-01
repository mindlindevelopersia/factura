import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { avisarAsignacion } from "@/lib/notificaciones/fuente";
import { prepararProducto } from "@/lib/producto/api";
import { pendientesSinCargar, RESPONSABLE_PENDIENTES } from "@/lib/producto/pendientes";
import { crearTarea, leerTareas } from "@/lib/tareas/fuente";
import { PROYECTO_PRODUCTO, type Tarea } from "@/lib/tareas/modelo";

/**
 * Carga como features los pendientes que propone el hub (los elegidos, o todos), a nombre de
 * Tadeo. Los que ya están en el tablero no se repiten. Un solo aviso para el responsable.
 */
export async function POST(req: Request) {
  const ctx = await prepararProducto("/producto/features");
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { titulos?: unknown };
  const pedidos = Array.isArray(body.titulos) ? new Set(body.titulos.map(String)) : null;
  try {
    const ya = (await leerTareas()).tareas.filter((t) => t.proyecto === PROYECTO_PRODUCTO).map((t) => t.titulo);
    const aCargar = pendientesSinCargar(ya).filter((p) => !pedidos || pedidos.has(p.titulo));
    const creadas: Tarea[] = [];
    for (const p of aCargar) creadas.push(await crearTarea({ titulo: p.titulo, descripcion: p.descripcion, prioridad: p.prioridad, tipo: "Otro", responsable: RESPONSABLE_PENDIENTES, proyecto: PROYECTO_PRODUCTO }, ctx.usuario, PROYECTO_PRODUCTO));
    if (creadas.length && RESPONSABLE_PENDIENTES !== ctx.usuario) {
      await avisarAsignacion({
        apodo: RESPONSABLE_PENDIENTES,
        titulo: creadas.length === 1 ? `el feature ${creadas[0].titulo}` : `${creadas.length} features pendientes`,
        texto: "Cada uno explica qué falta y el primer paso.",
        link: creadas.length === 1 ? `/producto/features?tarea=${creadas[0].id}` : "/producto/features",
        de: ctx.usuario,
        deEmail: ctx.email,
      }).catch((e) => console.error("pendientes aviso", e));
    }
    return NextResponse.json({ tareas: creadas });
  } catch (e) {
    return errorCrm(e, "producto features pendientes");
  }
}
