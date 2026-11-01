import { NextResponse } from "next/server";
import { exigir } from "@/lib/permisos/api";
import { datosPanorama, FlujoSinConfigurar } from "@/lib/finanzas/fuente";

/** Las series para comparar (CAC, IPC, dólar, materiales) y la alarma de materiales. ?fresco=1 vuelve a leer. */
export async function GET(req: Request) {
  const permiso = await exigir("/indicadores");
  if (permiso instanceof NextResponse) return permiso;
  try {
    const fresco = new URL(req.url).searchParams.get("fresco") === "1";
    return NextResponse.json(await datosPanorama({ fresco }));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("indicadores/panorama", e);
    return NextResponse.json({ error: `No se pudieron leer los indicadores. ${mensaje}` }, { status: e instanceof FlujoSinConfigurar ? 503 : 502 });
  }
}
