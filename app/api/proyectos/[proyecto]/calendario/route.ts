import { NextResponse } from "next/server";
import { calendario, agregarAgenda } from "@/lib/calendario/fuente";
import { validarAgenda } from "@/lib/calendario/eventos";
import { errorCrm, preparar } from "@/lib/crm/api";
import { EQUIPO_APODOS } from "@/lib/equipo";

/** Todos los eventos del proyecto (cobros, pagos, leads, propuestas y agenda). ?fresco=1 vuelve a leer las planillas. */
export async function GET(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto);
  if (ctx instanceof NextResponse) return ctx;
  const fresco = new URL(req.url).searchParams.get("fresco") === "1";
  return NextResponse.json({ ...(await calendario(ctx.proyecto.id, { fresco })), usuario: ctx.usuario, equipo: [...new Set([...EQUIPO_APODOS, ctx.usuario])] });
}

/** Un evento cargado a mano. */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto);
  if (ctx instanceof NextResponse) return ctx;
  const v = validarAgenda(await req.json().catch(() => null));
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    return NextResponse.json({ evento: await agregarAgenda(ctx.proyecto.id, v.datos, ctx.usuario) });
  } catch (e) {
    return errorCrm(e, "calendario POST");
  }
}
