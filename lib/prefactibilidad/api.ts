import "server-only";
import { NextResponse } from "next/server";
import { persona } from "../equipo";
import { PROYECTOS, rutaProyecto } from "../modulos";
import { exigir } from "../permisos/api";
import { perfilDe } from "../permisos/fuente";

/** Prefactibilidad se ve desde HQ o desde la prefactibilidad de algún proyecto: hace falta permiso para alguna. */
export async function prepararPrefactibilidad(proyecto?: string): Promise<{ usuario: string; email: string } | NextResponse> {
  const rutas = proyecto ? ["/prefactibilidad", rutaProyecto(proyecto, "prefactibilidad")] : ["/prefactibilidad", ...PROYECTOS.map((p) => rutaProyecto(p.id, "prefactibilidad"))];
  const permiso = await exigir(...rutas);
  if (permiso instanceof NextResponse) return permiso;
  const email = permiso.user.email.toLowerCase();
  const p = await perfilDe(email).catch(() => null);
  return { usuario: p?.apodo || persona(email, permiso.user.name).apodo, email };
}
