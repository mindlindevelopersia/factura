import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { actualizarPropuesta } from "@/lib/proyectos/propuestasFuente";
import { validarPropuesta } from "@/lib/proyectos/propuestasGuardadas";

/** Guarda los cambios de una propuesta. */
export async function PUT(req: Request, { params }: { params: Promise<{ proyecto: string; id: string }> }) {
  const { proyecto, id } = await params;
  const ctx = await preparar(proyecto, "comercial/propuesta");
  if (ctx instanceof NextResponse) return ctx;
  const v = validarPropuesta(await req.json().catch(() => null));
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const p = await actualizarPropuesta(ctx.proyecto.id, id, v.datos, ctx.usuario);
    if (!p) return NextResponse.json({ error: "No encontré esa propuesta." }, { status: 404 });
    return NextResponse.json({ propuesta: p });
  } catch (e) {
    return errorCrm(e, "propuestas PUT");
  }
}
