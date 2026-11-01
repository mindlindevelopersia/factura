import { NextResponse } from "next/server";
import { estadosDeUnidades, unidadesDisponibles } from "@/lib/finanzas/fuente";
import { errorCrm, preparar } from "@/lib/crm/api";
import { crearContacto, leerCrm } from "@/lib/crm/fuente";
import { nuevoId, validarContacto, type CambiosContacto, type Contacto } from "@/lib/crm/modelo";

/** Los contactos y la actividad del CRM (de todos los proyectos; la pantalla filtra), y las unidades disponibles del proyecto. */
export async function GET(_req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto);
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
  const ctx = await preparar((await params).proyecto);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await req.json().catch(() => ({}))) as { contacto?: CambiosContacto; nota?: string };
  const datos = body.contacto ?? {};
  const error = validarContacto(datos, true);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const ahora = new Date().toISOString();
  const c: Contacto = {
    id: nuevoId(),
    proyecto: ctx.proyecto.id,
    nombre: datos.nombre!.trim(),
    telefono: datos.telefono ?? "",
    mail: datos.mail ?? "",
    tipo: datos.tipo ?? "Beneficiario al costo",
    origen: datos.origen ?? "",
    referido: datos.referido ?? "",
    etapa: datos.etapa ?? "Nuevo",
    temperaturaManual: datos.temperaturaManual ?? null,
    presupuestoUsd: datos.presupuestoUsd ?? null,
    formaPago: datos.formaPago ?? "",
    plazo: datos.plazo ?? "",
    uso: datos.uso ?? "",
    ambientes: datos.ambientes ?? "",
    unidades: datos.unidades ?? [],
    proximoPaso: datos.proximoPaso ?? "",
    proximaFecha: datos.proximaFecha ?? null,
    motivoPerdida: datos.motivoPerdida ?? "",
    volverAContactar: datos.volverAContactar ?? null,
    notas: datos.notas ?? "",
    responsable: datos.responsable || ctx.usuario,
    creado: ahora,
    actualizado: ahora,
    entroEtapa: ahora,
    ultimoContacto: null,
    unidadVendida: datos.unidadVendida ?? "",
    precioVentaUsd: datos.precioVentaUsd ?? null,
  };
  try {
    const nota = body.nota?.trim();
    await crearContacto(c, { fecha: ahora, usuario: ctx.usuario, contactoId: c.id, contacto: c.nombre, tipo: "Nota", detalle: nota ? `Alta: ${nota}` : "Alta del contacto", etapa: c.etapa });
    return NextResponse.json({ contacto: c });
  } catch (e) {
    return errorCrm(e, "crm POST");
  }
}
