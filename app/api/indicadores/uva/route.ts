import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { historicoUva } from "@/lib/finanzas/fuente";
import { hoyBuenosAires } from "@/lib/inversores/cobranzas";
import { uvaDelDia } from "@/lib/prefactibilidad/plusvalia";

/** El UVA de hoy y, si se piden (?fechas=2026-01-15,2025-04-01), el de esos días. */
export async function GET(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const fechas = (new URL(req.url).searchParams.get("fechas") ?? "")
    .split(",")
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
    .slice(0, 10);
  try {
    const { valor } = await historicoUva();
    const r = (f: string) => {
      const u = uvaDelDia(valor.serie, f);
      return u ? { ...u, fuente: `UVA del ${u.fecha.split("-").reverse().join("/")} (${valor.fuente})` } : null;
    };
    return NextResponse.json({ hoy: r(hoyBuenosAires()), fechas: Object.fromEntries(fechas.map((f) => [f, r(f)])) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
