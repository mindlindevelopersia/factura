import { NextResponse } from "next/server";
import { indiceDeDatos } from "@/lib/buscador/fuente";
import { exigir } from "@/lib/permisos/api";
import { puedeRuta } from "@/lib/permisos/modelo";

/** Todo lo buscable de los datos (leads, propuestas, unidades, inversores, cobros, tareas), solo de lo que la persona puede ver. */
export async function GET() {
  const permiso = await exigir();
  if (permiso instanceof NextResponse) return permiso;
  const { resultados, faltan } = await indiceDeDatos();
  return NextResponse.json({ resultados: resultados.filter((r) => puedeRuta(permiso.acceso, r.href)), faltan });
}
