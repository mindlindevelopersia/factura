import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { dolarHoy } from "@/lib/finanzas/fuente";

/** El dólar de hoy (oficial, blue y MEP). ?fresco=1 vuelve a leer. */
export async function GET(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  try {
    const fresco = new URL(req.url).searchParams.get("fresco") === "1";
    const { valor, leido } = await dolarHoy({ fresco });
    return NextResponse.json({ ...valor, leido });
  } catch (e) {
    console.error("indicadores/dolar", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
