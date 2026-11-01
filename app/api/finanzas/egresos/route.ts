import { NextResponse } from "next/server";
import { exigir } from "@/lib/permisos/api";
import { PROYECTO_PRINCIPAL, rutaProyecto } from "@/lib/modulos";
import { cajaEgresos, FlujoSinConfigurar } from "@/lib/finanzas/fuente";

/** Los egresos de las pestañas de caja. ?fresco=1 vuelve a leer la planilla. */
export async function GET(req: Request) {
  const permiso = await exigir(rutaProyecto(PROYECTO_PRINCIPAL.id, "finanzas/egresos"));
  if (permiso instanceof NextResponse) return permiso;
  try {
    const fresco = new URL(req.url).searchParams.get("fresco") === "1";
    return NextResponse.json(await cajaEgresos({ fresco }));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("finanzas/egresos", e);
    return NextResponse.json({ error: `No se pudo leer la planilla. ${mensaje}` }, { status: e instanceof FlujoSinConfigurar ? 503 : 502 });
  }
}
