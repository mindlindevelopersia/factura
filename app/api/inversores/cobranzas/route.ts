import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { cobranzas, FlujoSinConfigurar } from "@/lib/finanzas/fuente";

/** Lo vencido y por vencer de cada inversor, actualizado por CAC. ?fresco=1 vuelve a leer las planillas. */
export async function GET(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  try {
    const fresco = new URL(req.url).searchParams.get("fresco") === "1";
    return NextResponse.json(await cobranzas({ fresco }));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("inversores/cobranzas", e);
    return NextResponse.json({ error: `No se pudo leer la planilla. ${mensaje}` }, { status: e instanceof FlujoSinConfigurar ? 503 : 502 });
  }
}
