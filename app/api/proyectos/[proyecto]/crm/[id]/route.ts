import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { actualizarContacto } from "@/lib/crm/fuente";
import { TIPOS_ACTIVIDAD, validarContacto, type CambiosContacto } from "@/lib/crm/modelo";

/** Cambia un contacto y, si viene, registra lo que se hizo (llamada, WhatsApp, nota…). */
export async function PATCH(req: Request, { params }: { params: Promise<{ proyecto: string; id: string }> }) {
  const { proyecto, id } = await params;
  const ctx = await preparar(proyecto);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { cambios?: CambiosContacto; actividad?: { tipo?: string; detalle?: string } };
  const cambios = body.cambios ?? {};
  const error = validarContacto(cambios, false);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const a = body.actividad;
  if (a && (!a.tipo || !(TIPOS_ACTIVIDAD as readonly string[]).includes(a.tipo))) return NextResponse.json({ error: "Tipo de actividad inválido." }, { status: 400 });
  if (a?.detalle && a.detalle.length > 2000) return NextResponse.json({ error: "La nota es demasiado larga." }, { status: 400 });
  const ahora = new Date().toISOString();
  try {
    const contacto = await actualizarContacto(id, cambios, a ? { fecha: ahora, usuario: ctx.usuario, contactoId: id, tipo: a.tipo!, detalle: (a.detalle ?? "").trim() } : null, ahora);
    if (!contacto) return NextResponse.json({ error: "No se encontró el contacto." }, { status: 404 });
    return NextResponse.json({ contacto });
  } catch (e) {
    return errorCrm(e, "crm PATCH");
  }
}
