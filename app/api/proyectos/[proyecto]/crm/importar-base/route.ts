import { NextResponse } from "next/server";
import { errorCrm, preparar } from "@/lib/crm/api";
import { actualizarContacto, importarContactos, leerCrm } from "@/lib/crm/fuente";
import { importarBase } from "@/lib/crm/importarBase";
import { idDePlanilla, leerPlanillaCompleta } from "@/lib/finanzas/fuente";

export const maxDuration = 60;

/**
 * Importa una planilla de contactos (la base de inversores). Sin "confirmar", solo dice qué haría
 * (nuevos, ya estaban, repetidos, qué se completa). Con "confirmar", lo hace. Lee todas las pestañas
 * que tengan una columna de nombre.
 */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto);
  if (ctx instanceof NextResponse) return ctx;
  const { planilla, confirmar } = (await req.json().catch(() => ({}))) as { planilla?: string; confirmar?: boolean };
  const id = idDePlanilla(planilla ?? "");
  if (!id) return NextResponse.json({ error: "Pegá el link de la planilla de Google." }, { status: 400 });
  try {
    const [pestanias, { contactos }] = await Promise.all([leerPlanillaCompleta(id), leerCrm()]);
    const ahora = new Date().toISOString();
    // Todas las pestañas con contactos, una detrás de otra (los duplicados entre pestañas también se sacan).
    let existentes = contactos;
    const resultados = pestanias.map((p) => {
      const r = importarBase(p.filas, existentes, ahora);
      existentes = [...existentes, ...r.nuevos];
      return { pestania: p.pestania, ...r };
    });
    const usadas = resultados.filter((r) => r.columnas);
    if (!usadas.length) return NextResponse.json({ error: "No encontré una columna de nombre en ninguna pestaña (los títulos tienen que estar en las primeras filas)." }, { status: 422 });
    const nuevos = usadas.flatMap((r) => r.nuevos);
    const completar = usadas.flatMap((r) => r.completar);
    if (confirmar) {
      await importarContactos(nuevos);
      for (const c of completar.slice(0, 200)) {
        await actualizarContacto(c.id, { ...(c.telefono ? { telefono: c.telefono } : {}), ...(c.mail ? { mail: c.mail } : {}) }, null, ahora);
      }
    }
    return NextResponse.json({
      confirmado: !!confirmar,
      pestanias: usadas.map((r) => ({ pestania: r.pestania, columnas: Object.keys(r.columnas!.campos), nuevos: r.nuevos.length, yaEstaban: r.yaEstaban.length, repetidos: r.repetidosEnPlanilla, sinNombre: r.sinNombre })),
      nuevos: nuevos.length,
      ejemplos: nuevos.slice(0, 8).map((c) => ({ nombre: c.nombre, mail: c.mail, telefono: c.telefono })),
      yaEstaban: usadas.flatMap((r) => r.yaEstaban).slice(0, 30),
      totalYaEstaban: usadas.reduce((s, r) => s + r.yaEstaban.length, 0),
      repetidos: usadas.reduce((s, r) => s + r.repetidosEnPlanilla, 0),
      completar: completar.length,
    });
  } catch (e) {
    return errorCrm(e, "crm importar-base");
  }
}
