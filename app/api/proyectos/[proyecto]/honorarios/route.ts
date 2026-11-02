import { NextResponse } from "next/server";
import { cashFlowProyecto } from "@/lib/finanzas/cashflowFuente";
import { cuentasCorrientes, datosComercial, FlujoSinConfigurar } from "@/lib/finanzas/fuente";
import { PROYECTO_PRINCIPAL, proyecto as buscar, rutaProyecto } from "@/lib/modulos";
import { exigir } from "@/lib/permisos/api";
import { presupuestoProyecto } from "@/lib/presupuesto/fuente";
import { esCostoDelProyecto, type DatosHonorarios, type PartidaCosto } from "@/lib/proyectos/honorarios";

/**
 * Los datos para los honorarios de los desarrolladores: lo cobrado y lo firmado (cuentas
 * corrientes y lista de precios), lo que queda sin vender, los m² vendibles y los costos del
 * proyecto (cash flow: lo real hasta hoy y lo proyectado de acá en más), en dólares.
 */
export async function GET(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const id = (await params).proyecto;
  const permiso = await exigir(rutaProyecto(id, "management/desarrolladores"));
  if (permiso instanceof NextResponse) return permiso;
  const p = buscar(id);
  if (!p?.management) return NextResponse.json({ error: "Este proyecto todavía no tiene definida la parte de los desarrolladores." }, { status: 404 });
  if (id !== PROYECTO_PRINCIPAL.id) return NextResponse.json({ error: "Por ahora los cobros están cargados solo para Lerma 439." }, { status: 404 });
  const fresco = new URL(req.url).searchParams.get("fresco") === "1";
  try {
    const [cc, com, cf, pres] = await Promise.all([
      cuentasCorrientes({ fresco }),
      datosComercial(id, { fresco }),
      cashFlowProyecto(id, { fresco }),
      presupuestoProyecto(id, { fresco }).catch((e: unknown) => (console.error("honorarios: presupuesto", e), null)),
    ]);
    const unidades = com.comercial.unidades;

    // Lo cobrado: todos los pagos de todas las cuentas (formales e informales), en dólares del día.
    const cobradoUsd = cc.cuentas.cuentas.reduce((s, c) => s + c.pagos.reduce((t, m) => t + (m.usd ?? 0), 0), 0);
    // Lo firmado: el precio de venta de cada unidad vendida (de Ventas o de Pagos por Inversor).
    const vendidas = unidades
      // Las cocheras que vienen con un depto ya están en el precio del depto.
      .filter((u) => u.estado === "vendida" && !u.incluidaEn)
      .map((u) => ({ codigo: u.codigo, inversor: u.inversor ?? "", precioUsd: u.precioVenta ?? u.precioCuenta ?? 0, contrato: u.contrato }));
    const firmadoUsd = vendidas.reduce((s, v) => s + v.precioUsd, 0);
    // Lo que queda: las libres del proyecto (las reventas son de sus dueños, no cuentan).
    const libres = unidades
      .filter((u) => u.estado === "libre" && !u.reventa && !u.incluidaEn && u.precioLista > 0)
      .map((u) => ({ codigo: u.codigo, tipologia: u.esCochera ? "Cochera" : u.tipologia, m2: u.supVenta, precioUsd: u.precioLista }));

    // Los costos: lo actualizado del cash flow (real hasta el mes pasado, proyectado de acá en más).
    const sumar = (usd: Record<string, number>) => Object.values(usd).reduce((s, x) => s + x, 0);
    const egresos = (ps: typeof cf.actualizado) => ps.filter((x) => x.tipo === "egreso").map((x): PartidaCosto => ({ nombre: x.nombre, grupo: x.grupo, usd: sumar(x.usd) }));
    const actualizados = egresos(cf.actualizado);
    // El costo: del presupuesto de obra si está cargado (pagado + lo que falta, por ítem); si no, del cash flow.
    const conPresupuesto = !!pres?.presupuesto.items.length;
    const costosPresupuesto: PartidaCosto[] = conPresupuesto
      ? [
          ...pres!.presupuesto.items.map((i) => ({ nombre: i.nombre, grupo: i.grupo, usd: i.costoFinalUsd })),
          ...pres!.presupuesto.grupos.filter((g) => g.sinItemUsd > 0).map((g) => ({ nombre: `Pagado sin ítem (${g.nombre})`, grupo: g.id, usd: g.sinItemUsd })),
        ]
      : [];
    const datos: DatosHonorarios = {
      parte: p.management.parteM2,
      cobradoUsd,
      firmadoUsd,
      libres,
      m2Venta: com.desarrolladores?.m2Venta ?? unidades.filter((u) => !u.esCochera).reduce((s, u) => s + u.supVenta, 0),
      costos: conPresupuesto ? costosPresupuesto.filter((x) => x.usd > 0) : actualizados.filter(esCostoDelProyecto).filter((x) => x.usd > 0),
      gastadoUsd: conPresupuesto ? pres!.presupuesto.total.pagadoUsd : egresos(cf.real).filter(esCostoDelProyecto).reduce((s, x) => s + x.usd, 0),
      excluidos: conPresupuesto ? [] : actualizados.filter((x) => !esCostoDelProyecto(x) && x.usd > 0),
    };
    const costoProyectadoOriginalUsd = egresos(cf.proyectado).filter(esCostoDelProyecto).reduce((s, x) => s + x.usd, 0);
    return NextResponse.json({ datos, vendidas, costoProyectadoOriginalUsd, fuenteCosto: conPresupuesto ? "presupuesto" : "cash-flow", mesActual: cf.mesActual, avisos: cf.avisos, leido: com.leido });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("honorarios", e);
    return NextResponse.json({ error: `No se pudieron leer los datos. ${mensaje}` }, { status: e instanceof FlujoSinConfigurar ? 503 : 502 });
  }
}
