import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { asignarPagoAMano, leerItems } from "@/lib/presupuesto/fuente";

/** Asigna a mano un pago de la caja a un ítem del presupuesto ("" = a ninguno). */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto, "finanzas/presupuesto");
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { clave?: unknown; item?: unknown; descripcion?: unknown };
  const clave = typeof body.clave === "string" ? body.clave.slice(0, 120) : "";
  const item = typeof body.item === "string" ? body.item : "";
  if (!clave) return NextResponse.json({ error: "Falta el pago." }, { status: 400 });
  try {
    if (item && !(await leerItems(ctx.proyecto.id)).some((i) => i.id === item)) return NextResponse.json({ error: "No encontré ese ítem." }, { status: 404 });
    await asignarPagoAMano({ proyecto: ctx.proyecto.id, clave, item, descripcion: typeof body.descripcion === "string" ? body.descripcion.slice(0, 200) : "", por: ctx.usuario });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorCrm(e, "presupuesto asignar");
  }
}
