import "server-only";
import { NextResponse } from "next/server";
import { getUser, type Usuario } from "../auth/session";
import { accesoDeEmail } from "./fuente";
import { puedeRuta, type Acceso } from "./modelo";

/**
 * Para las rutas de datos: el usuario y su acceso si puede abrir alguna de estas páginas del hub
 * (las que usan esos datos); si no, la respuesta 401 o 403.
 */
export async function exigir(...rutas: string[]): Promise<{ user: Usuario; acceso: Acceso } | NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  let acceso: Acceso;
  try {
    acceso = await accesoDeEmail(user.email);
  } catch (e) {
    console.error("permisos", e);
    return NextResponse.json({ error: "No se pudieron leer los permisos. Probá de nuevo en un rato." }, { status: 503 });
  }
  if (rutas.length && !rutas.some((r) => puedeRuta(acceso, r))) return NextResponse.json({ error: "No tenés permiso para ver esto. Pedíselo a un administrador." }, { status: 403 });
  return { user, acceso };
}
