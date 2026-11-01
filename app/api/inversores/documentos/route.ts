import { NextResponse } from "next/server";
import { cuentasCorrientes } from "@/lib/finanzas/fuente";
import { asignarCarpetas, documentosDe, type Documento } from "@/lib/inversores/documentos";
import { asignacionesManuales, asignarAMano, carpetasInversores, DocumentacionSinConfigurar } from "@/lib/inversores/documentosFuente";
import { PROYECTO_PRINCIPAL, rutaProyecto } from "@/lib/modulos";
import { exigir } from "@/lib/permisos/api";
import { perfilDe } from "@/lib/permisos/fuente";

const RUTA = rutaProyecto(PROYECTO_PRINCIPAL.id, "inversores/cuentas-corrientes");

/**
 * La documentación firmada de cada inversor (de Drive), por cuenta corriente y por unidad, y las
 * carpetas que no se pudieron asignar solas. ?fresco=1 vuelve a leer Drive.
 */
export async function GET(req: Request) {
  const permiso = await exigir(RUTA);
  if (permiso instanceof NextResponse) return permiso;
  const fresco = new URL(req.url).searchParams.get("fresco") === "1";
  try {
    const proyecto = PROYECTO_PRINCIPAL.id;
    const [carpetas, manuales, { cuentas }] = await Promise.all([carpetasInversores(proyecto, { fresco }), asignacionesManuales(proyecto).catch(() => ({})), cuentasCorrientes()]);
    const lista = cuentas.cuentas.map((c) => ({ id: c.id, inversor: c.inversor, unidad: c.unidad }));
    const a = asignarCarpetas(carpetas, lista, manuales);
    const porId = new Map(carpetas.map((c) => [c.id, c]));
    const porCuenta: Record<string, Documento[]> = {};
    const porUnidad: Record<string, Documento[]> = {};
    for (const [cuenta, ids] of Object.entries(a.porCuenta)) {
      const docs = ids.flatMap((id) => (porId.get(id) ? documentosDe(porId.get(id)!) : []));
      porCuenta[cuenta] = docs;
      const unidad = lista.find((c) => c.id === cuenta)?.unidad;
      if (unidad) porUnidad[unidad.toUpperCase()] = docs;
    }
    const carpetaDe: Record<string, string[]> = a.porCuenta;
    return NextResponse.json({
      porCuenta,
      porUnidad,
      carpetaDe,
      sinAsignar: a.sinAsignar.map((id) => ({ id, nombre: porId.get(id)!.nombre, documentos: documentosDe(porId.get(id)!).length })),
      carpetas: carpetas.map((c) => ({ id: c.id, nombre: c.nombre })),
      cuentas: lista,
    });
  } catch (e) {
    if (e instanceof DocumentacionSinConfigurar) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("inversores/documentos", e);
    return NextResponse.json({ error: `No se pudo leer la documentación. ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}

/** Asigna a mano una carpeta a una cuenta ("" = a ninguna). */
export async function POST(req: Request) {
  const permiso = await exigir(RUTA);
  if (permiso instanceof NextResponse) return permiso;
  const body = (await req.json().catch(() => null)) as { carpeta?: unknown; cuenta?: unknown } | null;
  const carpeta = typeof body?.carpeta === "string" ? body.carpeta : "";
  const cuenta = typeof body?.cuenta === "string" ? body.cuenta : "";
  try {
    const carpetas = await carpetasInversores(PROYECTO_PRINCIPAL.id);
    const c = carpetas.find((x) => x.id === carpeta);
    if (!c) return NextResponse.json({ error: "No encontré esa carpeta." }, { status: 404 });
    const { cuentas } = await cuentasCorrientes();
    if (cuenta && !cuentas.cuentas.some((x) => x.id === cuenta)) return NextResponse.json({ error: "No encontré esa cuenta corriente." }, { status: 404 });
    const { apodo } = await perfilDe(permiso.user.email);
    await asignarAMano({ proyecto: PROYECTO_PRINCIPAL.id, carpeta, nombre: c.nombre, cuenta, usuario: apodo });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof DocumentacionSinConfigurar) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("inversores/documentos POST", e);
    return NextResponse.json({ error: `No se pudo guardar. ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
