import { NextResponse } from "next/server";
import { exigir } from "@/lib/permisos/api";
import { PROYECTO_PRINCIPAL, rutaProyecto } from "@/lib/modulos";
import { flujoIngresos, FlujoSinConfigurar } from "@/lib/finanzas/fuente";

/** Los ingresos del proyecto Lerma, leídos de la planilla. ?fresco=1 la vuelve a leer. */
export async function GET(req: Request) {
  const permiso = await exigir(rutaProyecto(PROYECTO_PRINCIPAL.id, "finanzas/ingresos"));
  if (permiso instanceof NextResponse) return permiso;
  try {
    const fresco = new URL(req.url).searchParams.get("fresco") === "1";
    return NextResponse.json(await flujoIngresos({ fresco }));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("finanzas/ingresos", e);
    return NextResponse.json({ error: `No se pudo leer la planilla. ${mensaje}` }, { status: e instanceof FlujoSinConfigurar ? 503 : 502 });
  }
}
