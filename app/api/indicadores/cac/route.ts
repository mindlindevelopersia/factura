import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { FlujoSinConfigurar, serieCac } from "@/lib/finanzas/fuente";

/** La serie del índice CAC. ?fresco=1 vuelve a leer la planilla. */
export async function GET(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  try {
    const fresco = new URL(req.url).searchParams.get("fresco") === "1";
    return NextResponse.json(await serieCac({ fresco }));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("indicadores/cac", e);
    return NextResponse.json({ error: `No se pudo leer el índice CAC. ${mensaje}` }, { status: e instanceof FlujoSinConfigurar ? 503 : 502 });
  }
}
