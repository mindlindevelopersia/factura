import { NextResponse } from "next/server";
import { exigir } from "@/lib/permisos/api";
import { RUTA_FACTURAS } from "@/lib/modulos";
import { respuestaDeError, serviciosDesdeEnv } from "@/lib/cola/env";
import { listar } from "@/lib/cola/servicio";
import { enlaces } from "@/lib/enlaces";
import { resumirPanel } from "@/lib/panel";

/** El panel de inicio: números del mes, los últimos 12 meses, la cola y los accesos. */
export async function GET(req: Request) {
  const permiso = await exigir(RUTA_FACTURAS);
  if (permiso instanceof NextResponse) return permiso;
  try {
    const s = serviciosDesdeEnv(new URL(req.url).origin);
    const [cola, registros, accesos] = await Promise.all([
      listar(s),
      s.planilla
        ? s.planilla.registros().then(
            (r) => ({ movimientos: r.movimientos, error: null }),
            (e: unknown) => ({ movimientos: null, error: e instanceof Error ? e.message : String(e) }),
          )
        : Promise.resolve({ movimientos: null, error: "Falta configurar la planilla (SHEET_ID)." }),
      enlaces(),
    ]);
    const resumen = resumirPanel(registros.movimientos, [...cola.pendientes, ...cola.historial], new Date(), registros.error);
    return NextResponse.json({ resumen, enlaces: accesos });
  } catch (e) {
    return respuestaDeError(e);
  }
}
