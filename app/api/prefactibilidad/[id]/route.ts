import { NextResponse } from "next/server";
import { errorCrm } from "@/lib/crm/api";
import { hoyBuenosAires } from "@/lib/inversores/cobranzas";
import { proyecto as buscarProyecto } from "@/lib/modulos";
import { prepararPrefactibilidad } from "@/lib/prefactibilidad/api";
import { actualizarPrefactibilidad, guardarVersion, leerPrefactibilidades, leerVersiones } from "@/lib/prefactibilidad/fuente";
import { carpetaValida, limpiarDatos, type Prefactibilidad } from "@/lib/prefactibilidad/modelo";

async function buscar(id: string) {
  return (await leerPrefactibilidades()).find((p) => p.id === id) ?? null;
}

/** Una prefactibilidad con sus versiones. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const p = await buscar(id);
    const ctx = await prepararPrefactibilidad(p?.proyecto || undefined);
    if (ctx instanceof NextResponse) return ctx;
    if (!p) return NextResponse.json({ error: "No encontré esa prefactibilidad." }, { status: 404 });
    return NextResponse.json({ prefactibilidad: p, versiones: await leerVersiones(id), usuario: ctx.usuario });
  } catch (e) {
    return errorCrm(e, "prefactibilidad GET uno");
  }
}

/**
 * Guarda cambios: nombre, carpeta de Drive, estado (en análisis o descartada), datos, y el
 * proyecto (asignarla a uno guarda una versión; "" la vuelve a análisis).
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  try {
    const actual = await buscar(id);
    if (!actual) {
      const ctx = await prepararPrefactibilidad();
      return ctx instanceof NextResponse ? ctx : NextResponse.json({ error: "No encontré esa prefactibilidad." }, { status: 404 });
    }
    const nuevoProyecto = typeof body.proyecto === "string" ? body.proyecto : undefined;
    const ctx = await prepararPrefactibilidad(nuevoProyecto || actual.proyecto || undefined);
    if (ctx instanceof NextResponse) return ctx;
    const cambios: Partial<Prefactibilidad> = {};
    if (typeof body.nombre === "string") {
      if (!body.nombre.trim()) return NextResponse.json({ error: "La prefactibilidad necesita un nombre." }, { status: 400 });
      cambios.nombre = body.nombre.trim().slice(0, 120);
    }
    if (typeof body.carpeta === "string") {
      const c = carpetaValida(body.carpeta);
      if (body.carpeta.trim() && !c) return NextResponse.json({ error: "El link de la carpeta tiene que ser de Google Drive (https://drive.google.com/…)." }, { status: 400 });
      cambios.carpeta = c;
    }
    if (body.estado === "En análisis" || body.estado === "Descartada") cambios.estado = body.estado;
    if (body.datos !== undefined) cambios.datos = limpiarDatos(body.datos, hoyBuenosAires());
    if (nuevoProyecto !== undefined && nuevoProyecto !== actual.proyecto) {
      if (nuevoProyecto) {
        const p = buscarProyecto(nuevoProyecto);
        if (!p) return NextResponse.json({ error: "Ese proyecto no existe." }, { status: 400 });
        const ya = (await leerPrefactibilidades()).find((x) => x.proyecto === nuevoProyecto && x.id !== id);
        if (ya) return NextResponse.json({ error: `${p.nombre} ya tiene asignada "${ya.nombre}". Sacala de ahí primero.` }, { status: 400 });
        cambios.proyecto = nuevoProyecto;
        cambios.estado = "Asignada";
      } else {
        cambios.proyecto = "";
        cambios.estado = "En análisis";
      }
    }
    const p = await actualizarPrefactibilidad(id, cambios, ctx.usuario);
    if (!p) return NextResponse.json({ error: "No encontré esa prefactibilidad." }, { status: 404 });
    if (cambios.proyecto) await guardarVersion(p, `Asignada a ${buscarProyecto(cambios.proyecto)?.nombre ?? cambios.proyecto}`, ctx.usuario);
    return NextResponse.json({ prefactibilidad: p });
  } catch (e) {
    return errorCrm(e, "prefactibilidad PUT");
  }
}
