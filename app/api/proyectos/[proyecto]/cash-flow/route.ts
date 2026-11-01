import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { cashFlowProyecto } from "@/lib/finanzas/cashflowFuente";
import { FlujoSinConfigurar } from "@/lib/finanzas/fuente";
import { proyecto as buscar } from "@/lib/modulos";

/** El cash flow del proyecto (proyectado, real y actualizado). ?fresco=1 vuelve a leer las planillas. */
export async function GET(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const p = buscar((await params).proyecto);
  if (!p || p.estado !== "activo") return NextResponse.json({ error: "Proyecto inexistente." }, { status: 404 });
  try {
    return NextResponse.json(await cashFlowProyecto(p.id, { fresco: new URL(req.url).searchParams.get("fresco") === "1" }));
  } catch (e) {
    console.error("cash-flow", e);
    const mensaje = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `No se pudo armar el cash flow. ${mensaje}` }, { status: e instanceof FlujoSinConfigurar ? 503 : 502 });
  }
}
