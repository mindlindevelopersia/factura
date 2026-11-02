import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { nuevoId } from "@/lib/crm/modelo";
import { validarItem, type ItemPresupuesto } from "@/lib/presupuesto/modelo";
import { cargarFaltantes, cargarPlantilla, guardarItem, leerItems, presupuestoProyecto } from "@/lib/presupuesto/fuente";

/** El presupuesto del proyecto contra lo pagado. ?fresco=1 vuelve a leer las planillas. */
export async function GET(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto, "finanzas/presupuesto");
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json(await presupuestoProyecto(ctx.proyecto.id, { fresco: new URL(req.url).searchParams.get("fresco") === "1" }));
  } catch (e) {
    return errorCrm(e, "presupuesto GET");
  }
}

/**
 * { plantilla: true } carga los rubros base (con los montos del Excel madre) si todavía no hay
 * presupuesto; { faltantes: true } suma los rubros nuevos de la plantilla; { item: {...} } agrega
 * un ítem nuevo.
 */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto, "finanzas/presupuesto");
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { plantilla?: boolean; faltantes?: boolean; item?: unknown };
  try {
    if (body.plantilla) return NextResponse.json({ cargados: await cargarPlantilla(ctx.proyecto.id, ctx.usuario) });
    if (body.faltantes) return NextResponse.json({ cargados: await cargarFaltantes(ctx.proyecto.id, ctx.usuario) });
    const v = validarItem(body.item);
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
    if (!v.cambios.nombre) return NextResponse.json({ error: "El ítem necesita un nombre." }, { status: 400 });
    const existentes = await leerItems(ctx.proyecto.id);
    const grupo = v.cambios.grupo ?? "hard";
    const item: ItemPresupuesto = {
      id: `i-${nuevoId().slice(1)}`,
      proyecto: ctx.proyecto.id,
      grupo,
      nombre: v.cambios.nombre,
      orden: Math.max(0, ...existentes.filter((i) => i.grupo === grupo).map((i) => i.orden)) + 1,
      moneda: v.cambios.moneda ?? "USD",
      monto: v.cambios.monto ?? null,
      baseCac: v.cambios.baseCac ?? null,
      proveedor: v.cambios.proveedor ?? "",
      estado: v.cambios.estado ?? "estimado",
      faltaUsd: v.cambios.faltaUsd ?? null,
      notas: v.cambios.notas ?? "",
      actualizado: new Date().toISOString(),
      por: ctx.usuario,
    };
    await guardarItem(item);
    return NextResponse.json({ item });
  } catch (e) {
    return errorCrm(e, "presupuesto POST");
  }
}
