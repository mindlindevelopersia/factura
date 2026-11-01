import { NextResponse } from "next/server";
import { exigir } from "@/lib/permisos/api";
import { PROYECTO_PRINCIPAL, rutaProyecto } from "@/lib/modulos";
import { cobranzas, FlujoSinConfigurar } from "@/lib/finanzas/fuente";

/** Lo vencido y por vencer de cada inversor, actualizado por CAC. ?fresco=1 vuelve a leer las planillas. */
export async function GET(req: Request) {
  const permiso = await exigir(rutaProyecto(PROYECTO_PRINCIPAL.id, "inversores/cobranzas"));
  if (permiso instanceof NextResponse) return permiso;
  try {
    const fresco = new URL(req.url).searchParams.get("fresco") === "1";
    return NextResponse.json(await cobranzas({ fresco }));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("inversores/cobranzas", e);
    return NextResponse.json({ error: `No se pudo leer la planilla. ${mensaje}` }, { status: e instanceof FlujoSinConfigurar ? 503 : 502 });
  }
}
