import { NextResponse } from "next/server";
import { cajaEgresos, grillaEERR } from "@/lib/finanzas/fuente";
import { proyecto as buscarProyecto } from "@/lib/modulos";
import { prepararPrefactibilidad } from "@/lib/prefactibilidad/api";
import { leerPrefactibilidades } from "@/lib/prefactibilidad/fuente";
import { plusvaliaDeEERR } from "@/lib/prefactibilidad/plusvalia";

/**
 * Los datos de la plusvalía del Excel madre del proyecto (pestaña EE.RR) y el pago registrado en
 * la caja ("plusvalía" en la descripción). Devuelve una sugerencia: la pantalla la muestra para
 * revisar y guardar.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pf = (await leerPrefactibilidades().catch(() => [])).find((x) => x.id === id);
  const ctx = await prepararPrefactibilidad(pf?.proyecto || undefined);
  if (ctx instanceof NextResponse) return ctx;
  if (!pf?.proyecto) return NextResponse.json({ error: "La prefactibilidad no está asignada a un proyecto con Excel madre." }, { status: 400 });
  const p = buscarProyecto(pf.proyecto)!;
  try {
    const [eerr, caja] = await Promise.all([grillaEERR(p.id), cajaEgresos().catch(() => null)]);
    const clave = p.nombre.toLowerCase().split(/\s+/)[0];
    const pagos = (caja?.caja.egresos ?? []).filter((e) => e.fecha && /plusval/i.test(`${e.descripcion} ${e.categoria}`) && e.proyecto.toLowerCase().includes(clave) && e.moneda === "ARS").sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
    return NextResponse.json({ plusvalia: plusvaliaDeEERR(eerr), pago: pagos[0] ? { fecha: pagos[0].fecha, monto: pagos[0].monto, descripcion: pagos[0].descripcion } : null });
  } catch (e) {
    console.error("plusvalia excel", e);
    return NextResponse.json({ error: `No pude leer el Excel madre. ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
