import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { crearPropuesta, leerPropuestas } from "@/lib/proyectos/propuestasFuente";
import { validarPropuesta } from "@/lib/proyectos/propuestasGuardadas";

/** Las propuestas guardadas del proyecto. */
export async function GET(_req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto, "comercial/propuesta");
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json({ propuestas: await leerPropuestas(ctx.proyecto.id) });
  } catch (e) {
    return errorCrm(e, "propuestas GET");
  }
}

/** Guarda una propuesta nueva. */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto, "comercial/propuesta");
  if (ctx instanceof NextResponse) return ctx;
  const v = validarPropuesta(await req.json().catch(() => null));
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    return NextResponse.json({ propuesta: await crearPropuesta(ctx.proyecto.id, v.datos, ctx.usuario) });
  } catch (e) {
    return errorCrm(e, "propuestas POST");
  }
}
