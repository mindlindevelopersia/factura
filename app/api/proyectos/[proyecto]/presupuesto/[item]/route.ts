import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { validarItem } from "@/lib/presupuesto/modelo";
import { borrarItem, guardarItem, leerItems } from "@/lib/presupuesto/fuente";

type Params = { params: Promise<{ proyecto: string; item: string }> };

/** Cambia un ítem del presupuesto. */
export async function PATCH(req: Request, { params }: Params) {
  const { proyecto, item } = await params;
  const ctx = await preparar(proyecto, "finanzas/presupuesto");
  if (ctx instanceof NextResponse) return ctx;
  const v = validarItem(await req.json().catch(() => null));
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    const actual = (await leerItems(ctx.proyecto.id)).find((i) => i.id === item);
    if (!actual) return NextResponse.json({ error: "No encontré ese ítem." }, { status: 404 });
    const nuevo = { ...actual, ...v.cambios, id: actual.id, proyecto: actual.proyecto, actualizado: new Date().toISOString(), por: ctx.usuario };
    await guardarItem(nuevo);
    return NextResponse.json({ item: nuevo });
  } catch (e) {
    return errorCrm(e, "presupuesto PATCH");
  }
}

/** Borra un ítem del presupuesto (sus pagos quedan sin ítem). */
export async function DELETE(_req: Request, { params }: Params) {
  const { proyecto, item } = await params;
  const ctx = await preparar(proyecto, "finanzas/presupuesto");
  if (ctx instanceof NextResponse) return ctx;
  try {
    if (!(await borrarItem(ctx.proyecto.id, item))) return NextResponse.json({ error: "No encontré ese ítem." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorCrm(e, "presupuesto DELETE");
  }
}
