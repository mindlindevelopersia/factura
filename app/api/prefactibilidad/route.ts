import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { hoyBuenosAires } from "@/lib/inversores/cobranzas";
import { prepararPrefactibilidad } from "@/lib/prefactibilidad/api";
import { crearPrefactibilidad, leerPrefactibilidades } from "@/lib/prefactibilidad/fuente";
import { datosVacios } from "@/lib/prefactibilidad/modelo";

/** Todas las prefactibilidades (en análisis, asignadas a un proyecto y descartadas). */
export async function GET() {
  const ctx = await prepararPrefactibilidad();
  if (ctx instanceof NextResponse) return ctx;
  try {
    const lista = (await leerPrefactibilidades()).sort((a, b) => b.actualizada.localeCompare(a.actualizada));
    return NextResponse.json({ prefactibilidades: lista, usuario: ctx.usuario });
  } catch (e) {
    return errorCrm(e, "prefactibilidad GET");
  }
}

/** Una nueva (en blanco). */
export async function POST(req: Request) {
  const ctx = await prepararPrefactibilidad();
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { nombre?: unknown };
  const nombre = typeof body.nombre === "string" ? body.nombre.trim().slice(0, 120) : "";
  if (!nombre) return NextResponse.json({ error: "Poné un nombre (por ejemplo, la dirección del lote)." }, { status: 400 });
  try {
    const d = datosVacios(hoyBuenosAires());
    return NextResponse.json({ prefactibilidad: await crearPrefactibilidad(nombre, { ...d, direccion: nombre }, ctx.usuario) });
  } catch (e) {
    return errorCrm(e, "prefactibilidad POST");
  }
}
