import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { registroAvisos } from "@/lib/finanzas/fuente";
import { validarAviso, type AvisoCobranza } from "@/lib/inversores/avisos";

const SIN_REGISTRO = "El registro de avisos no está configurado: falta la planilla de la cola (COLA_SHEET_ID) en Vercel.";

/** El registro de avisos de cobranza. */
export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const registro = registroAvisos();
  if (!registro) return NextResponse.json({ error: SIN_REGISTRO }, { status: 503 });
  try {
    return NextResponse.json({ avisos: await registro.listar() });
  } catch (e) {
    console.error("cobranzas/avisos", e);
    return NextResponse.json({ error: `No se pudo leer el registro. ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}

/** Anota un aviso (quién lo registra sale de la sesión). */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const registro = registroAvisos();
  if (!registro) return NextResponse.json({ error: SIN_REGISTRO }, { status: 503 });
  const datos = (await req.json().catch(() => ({}))) as Partial<AvisoCobranza>;
  const error = validarAviso(datos);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const aviso: AvisoCobranza = {
    fecha: new Date().toISOString(),
    usuario: user.email,
    cuenta: String(datos.cuenta),
    inversor: String(datos.inversor),
    unidad: String(datos.unidad ?? ""),
    canal: String(datos.canal),
    estado: String(datos.estado),
    monto: String(datos.monto ?? ""),
    nota: String(datos.nota ?? "").trim(),
  };
  try {
    await registro.agregar(aviso);
    return NextResponse.json({ aviso });
  } catch (e) {
    console.error("cobranzas/avisos", e);
    return NextResponse.json({ error: `No se pudo guardar el aviso. ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
