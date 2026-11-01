import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { marcarLeidas } from "@/lib/notificaciones/fuente";

/** Marca notificaciones como leídas. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string" && x.length < 200) : [];
  if (!ids.length) return NextResponse.json({ ok: true });
  try {
    await marcarLeidas(user.email, ids);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("notificaciones leidas", e);
    return NextResponse.json({ error: "No se pudo marcar como leída." }, { status: 502 });
  }
}
