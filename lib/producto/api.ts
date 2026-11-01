import "server-only";
import { NextResponse } from "next/server";
import { persona } from "../equipo";
import { exigir } from "../permisos/api";
import { perfilDe } from "../permisos/fuente";

/** El usuario (con su @usuario) si puede ver esta parte de Producto; si no, la respuesta de error. */
export async function prepararProducto(ruta: "/producto/ideas" | "/producto/features"): Promise<{ usuario: string; email: string } | NextResponse> {
  const permiso = await exigir(ruta);
  if (permiso instanceof NextResponse) return permiso;
  const email = permiso.user.email.toLowerCase();
  const p = await perfilDe(email).catch(() => null);
  return { usuario: p?.apodo || persona(email, permiso.user.name).apodo, email };
}
