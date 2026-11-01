import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { prepararPrefactibilidad } from "@/lib/prefactibilidad/api";
import { actualizarPrefactibilidad, guardarVersion, leerPrefactibilidades, leerVersiones } from "@/lib/prefactibilidad/fuente";

/**
 * { nombre }: guarda una versión con cómo está ahora.
 * { restaurar: idVersion }: vuelve a esa versión (antes guarda cómo estaba, para no perder nada).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { nombre?: unknown; restaurar?: unknown };
  try {
    const p = (await leerPrefactibilidades()).find((x) => x.id === id);
    const ctx = await prepararPrefactibilidad(p?.proyecto || undefined);
    if (ctx instanceof NextResponse) return ctx;
    if (!p) return NextResponse.json({ error: "No encontré esa prefactibilidad." }, { status: 404 });
    if (typeof body.restaurar === "string") {
      const v = (await leerVersiones(id)).find((x) => x.id === body.restaurar);
      if (!v) return NextResponse.json({ error: "No encontré esa versión." }, { status: 404 });
      await guardarVersion(p, `Antes de volver a "${v.nombre}"`, ctx.usuario);
      const nueva = await actualizarPrefactibilidad(id, { datos: v.datos }, ctx.usuario);
      return NextResponse.json({ prefactibilidad: nueva, versiones: await leerVersiones(id) });
    }
    const nombre = typeof body.nombre === "string" ? body.nombre.trim().slice(0, 120) : "";
    if (!nombre) return NextResponse.json({ error: "Poné un nombre a la versión (por ejemplo, “Antes de comprar el lote”)." }, { status: 400 });
    await guardarVersion(p, nombre, ctx.usuario);
    return NextResponse.json({ versiones: await leerVersiones(id) });
  } catch (e) {
    return errorCrm(e, "prefactibilidad versiones");
  }
}
