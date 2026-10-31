import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { datosComercial, FlujoSinConfigurar } from "@/lib/finanzas/fuente";
import { proyecto as buscar } from "@/lib/modulos";

/** Unidades, lista de precios, superficies y management de un proyecto. ?fresco=1 vuelve a leer. */
export async function GET(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const { proyecto } = await params;
  const p = buscar(proyecto);
  if (!p || p.estado !== "activo") return NextResponse.json({ error: "Proyecto inexistente o todavía en preparación." }, { status: 404 });
  try {
    const fresco = new URL(req.url).searchParams.get("fresco") === "1";
    return NextResponse.json(await datosComercial(proyecto, { fresco }));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("proyectos/comercial", e);
    return NextResponse.json({ error: `No se pudo leer el Excel madre. ${mensaje}` }, { status: e instanceof FlujoSinConfigurar ? 503 : 502 });
  }
}
