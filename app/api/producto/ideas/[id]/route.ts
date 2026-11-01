import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { avisarMenciones } from "@/lib/notificaciones/fuente";
import { prepararProducto } from "@/lib/producto/api";
import { actualizarIdea, leerIdeas } from "@/lib/producto/fuente";
import { validarIdea } from "@/lib/producto/ideas";
import { exigir } from "@/lib/permisos/api";
import { crearTarea } from "@/lib/tareas/fuente";
import { PROYECTO_PRODUCTO } from "@/lib/tareas/modelo";

/** Cambia una idea (título, descripción, estado) o la pasa a Features ({ aFeatures: true }). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await prepararProducto("/producto/ideas");
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const v = validarIdea(body, false);
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    let cambios: Parameters<typeof actualizarIdea>[1] = v.cambios;
    if (body?.aFeatures === true) {
      // Para pasarla al kanban hace falta poder ver Features.
      const puede = await exigir("/producto/features");
      if (puede instanceof NextResponse) return puede;
      const actual = (await leerIdeas()).ideas.find((i) => i.id === id);
      if (!actual) return NextResponse.json({ error: "No encontré esa idea." }, { status: 404 });
      if (actual.featureId) return NextResponse.json({ error: "Esa idea ya está en Features." }, { status: 400 });
      const feature = await crearTarea({ titulo: actual.titulo, descripcion: `${actual.texto}\n\n(De la idea de ${actual.autor} en Producto · Ideas.)`.trim(), responsable: "", proyecto: PROYECTO_PRODUCTO }, ctx.usuario, PROYECTO_PRODUCTO);
      cambios = { ...cambios, estado: "En features", featureId: feature.id };
    }
    const r = await actualizarIdea(id, cambios);
    if (!r) return NextResponse.json({ error: "No encontré esa idea." }, { status: 404 });
    await avisarMenciones({ antes: `${r.antes.titulo}\n${r.antes.texto}`, texto: `${r.idea.titulo}\n${r.idea.texto}`, titulo: `Idea: ${r.idea.titulo}`, link: `/producto/ideas?idea=${id}`, de: ctx.usuario, deEmail: ctx.email });
    return NextResponse.json({ idea: r.idea });
  } catch (e) {
    return errorCrm(e, "producto ideas PATCH");
  }
}
