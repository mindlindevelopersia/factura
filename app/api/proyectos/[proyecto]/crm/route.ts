import { NextResponse } from "next/server";
import { estadosDeUnidades, unidadesDisponibles } from "@/lib/finanzas/fuente";
import { errorCrm, preparar } from "@/lib/crm/api";
import { crearContacto, leerCrm } from "@/lib/crm/fuente";
import { contactoNuevo, nuevoId, validarContacto, type CambiosContacto, type Contacto } from "@/lib/crm/modelo";
import { rutaProyecto } from "@/lib/modulos";
import { avisarAsignacion, avisarMenciones } from "@/lib/notificaciones/fuente";

/** Los contactos y la actividad del CRM (de todos los proyectos; la pantalla filtra), y las unidades disponibles del proyecto. */
export async function GET(_req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto, "comercial/crm", "comercial/propuesta");
  if (ctx instanceof NextResponse) return ctx;
  try {
    const [crm, unidades, estados] = await Promise.all([leerCrm(), unidadesDisponibles(ctx.proyecto.id), estadosDeUnidades(ctx.proyecto.id)]);
    return NextResponse.json({ ...crm, actividad: crm.actividad.slice(0, 1500), unidades, estados, usuario: ctx.usuario, ahora: new Date().toISOString() });
  } catch (e) {
    return errorCrm(e, "crm GET");
  }
}

/** Un contacto nuevo. */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto, "comercial/crm", "comercial/propuesta");
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { contacto?: CambiosContacto; nota?: string };
  const datos = body.contacto ?? {};
  const error = validarContacto(datos, true);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const ahora = new Date().toISOString();
  const c: Contacto = contactoNuevo(datos, { id: nuevoId(), proyecto: ctx.proyecto.id, usuario: ctx.usuario, ahora });
  try {
    const nota = body.nota?.trim();
    await crearContacto(c, { fecha: ahora, usuario: ctx.usuario, contactoId: c.id, contacto: c.nombre, tipo: "Nota", detalle: nota ? `Alta: ${nota}` : "Alta del contacto", etapa: c.etapa });
    const link = `${rutaProyecto(ctx.proyecto.id, "comercial/crm")}?contacto=${c.id}`;
    const de = { de: ctx.usuario, deEmail: ctx.email };
    await Promise.all([
      avisarMenciones({ texto: `${nota ?? ""}\n${c.notas}`, titulo: `Lead nuevo: ${c.nombre}`, link, ...de }),
      avisarAsignacion({ apodo: c.responsable, titulo: `el lead nuevo ${c.nombre}`, texto: c.etapa, link, ...de }),
    ]);
    return NextResponse.json({ contacto: c });
  } catch (e) {
    return errorCrm(e, "crm POST");
  }
}
