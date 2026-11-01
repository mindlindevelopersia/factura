import { NextResponse } from "next/server";
import { filasCrmMadre } from "@/lib/finanzas/fuente";
import { errorCrm, preparar } from "@/lib/crm/api";
import { hoyBA } from "@/lib/crm/alarmas";
import { importarContactos, leerCrm } from "@/lib/crm/fuente";
import { importarCrm } from "@/lib/crm/importar";

export const maxDuration = 60;

/** Trae los contactos de la pestaña "CRM" del Excel madre (los que ya están no se repiten). */
export async function POST(_req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto, "comercial/crm");
  if (ctx instanceof NextResponse) return ctx;
  try {
    const [filas, { contactos }] = await Promise.all([filasCrmMadre(ctx.proyecto.id), leerCrm()]);
    const ahora = new Date().toISOString();
    const nuevos = importarCrm(filas, contactos, ctx.proyecto.id, ahora, hoyBA());
    await importarContactos(nuevos);
    return NextResponse.json({ importados: nuevos.length });
  } catch (e) {
    return errorCrm(e, "crm importar");
  }
}
