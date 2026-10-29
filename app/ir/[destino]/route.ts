import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { esDestino, urlDe } from "@/lib/enlaces";

/**
 * /ir/planilla-egresos, /ir/drive-compra...: lleva a la planilla o a la carpeta de Drive. Pide
 * sesión (además de proxy.ts), así los links de Google no están en ninguna página.
 * ?fila=230 abre la planilla en esa fila.
 */
export async function GET(req: Request, { params }: { params: Promise<{ destino: string }> }) {
  if (!(await getUser())) return NextResponse.redirect(new URL("/login", req.url));
  const { destino } = await params;
  if (!esDestino(destino)) return new NextResponse("Ese acceso no existe.", { status: 404 });
  const fila = Number(new URL(req.url).searchParams.get("fila"));
  const r = await urlDe(destino, Number.isInteger(fila) && fila > 1 ? fila : undefined);
  if ("falta" in r) return new NextResponse(r.falta, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return NextResponse.redirect(r.url);
}
