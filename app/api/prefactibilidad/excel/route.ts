import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { proyecto as buscarProyecto } from "@/lib/modulos";
import { prepararPrefactibilidad } from "@/lib/prefactibilidad/api";
import { leerPrefactibilidades, prefactibilidadDesdeExcel } from "@/lib/prefactibilidad/fuente";

/** { proyecto }: arma la prefactibilidad del proyecto con su Excel madre (Superficies y lista de precios), ya asignada. */
export async function POST(req: Request) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { proyecto?: unknown };
  const id = typeof body.proyecto === "string" ? body.proyecto : "";
  const p = buscarProyecto(id);
  const ctx = await prepararPrefactibilidad(p ? id : undefined);
  if (ctx instanceof NextResponse) return ctx;
  if (!p || !p.planillaMadre) return NextResponse.json({ error: "Ese proyecto no tiene Excel madre." }, { status: 400 });
  try {
    if ((await leerPrefactibilidades()).some((x) => x.proyecto === id)) return NextResponse.json({ error: `${p.nombre} ya tiene una prefactibilidad asignada.` }, { status: 400 });
    return NextResponse.json({ prefactibilidad: await prefactibilidadDesdeExcel(id, ctx.usuario) });
  } catch (e) {
    return errorCrm(e, "prefactibilidad excel");
  }
}
