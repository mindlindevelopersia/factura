import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { leerCashFlowMadre, mepDeSerie } from "../finanzas/cashflow";
import { cajaEgresos, datosComercial, dolarHoy, grillaCashFlow, historicoMep, serieCac } from "../finanzas/fuente";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { proyecto as buscarProyecto } from "../modulos";
import { calcularPresupuesto, COLUMNAS_PRESUPUESTO, filaDeItem, itemDeFila, plantilla, type ContextoPrecios, type ItemPresupuesto, type PagoCaja, type Presupuesto } from "./modelo";

/**
 * El presupuesto de cada proyecto vive en la planilla del CRM (la que el hub puede escribir):
 * pestaña "Presupuesto" (un ítem por fila) y "Presupuesto pagos" (los pagos de la caja asignados
 * a mano a un ítem). Lo pagado sale de las cajas de egresos; los precios, del CAC y el MEP.
 */

const COLUMNAS_PAGOS = ["Proyecto", "Pago (pestaña:fila)", "Ítem", "Descripción", "Asignó", "Fecha"] as const;

function pestanias() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel) para guardar el presupuesto.");
  return { items: new PestaniaSimple(client, sheet, "Presupuesto", COLUMNAS_PRESUPUESTO), pagos: new PestaniaSimple(client, sheet, "Presupuesto pagos", COLUMNAS_PAGOS) };
}

export async function leerItems(proyecto: string): Promise<ItemPresupuesto[]> {
  return (await pestanias().items.filas()).filter((f) => f[0] === proyecto && f[1]).map(itemDeFila);
}

/** Crea o reemplaza un ítem (por proyecto + ID). */
export async function guardarItem(i: ItemPresupuesto): Promise<void> {
  const t = pestanias().items;
  const filas = await t.filas();
  const n = filas.findIndex((f) => f[0] === i.proyecto && f[1] === i.id);
  if (n >= 0) await t.escribir(n + 2, filaDeItem(i));
  else await t.agregar(filaDeItem(i));
}

/** Borra un ítem (deja la fila vacía). */
export async function borrarItem(proyecto: string, id: string): Promise<boolean> {
  const t = pestanias().items;
  const filas = await t.filas();
  const n = filas.findIndex((f) => f[0] === proyecto && f[1] === id);
  if (n < 0) return false;
  await t.escribir(n + 2, COLUMNAS_PRESUPUESTO.map(() => ""));
  return true;
}

export async function asignacionesManuales(proyecto: string): Promise<Record<string, string>> {
  const r: Record<string, string> = {};
  for (const f of await pestanias().pagos.filas()) if (f[0] === proyecto && f[1]) r[f[1]] = f[2] ?? "";
  return r;
}

export async function asignarPagoAMano(o: { proyecto: string; clave: string; item: string; descripcion: string; por: string }): Promise<void> {
  const t = pestanias().pagos;
  const filas = await t.filas();
  const n = filas.findIndex((f) => f[0] === o.proyecto && f[1] === o.clave);
  const fila = [o.proyecto, o.clave, o.item, o.descripcion, o.por, new Date().toISOString()];
  if (n >= 0) await t.escribir(n + 2, fila);
  else await t.agregar(fila);
}

/** Las líneas de egreso del cash flow del Excel madre, con su total en dólares (para la plantilla). */
async function lineasExcel(id: string): Promise<{ nombre: string; usd: number }[]> {
  const { filas } = await grillaCashFlow(id);
  return leerCashFlowMadre(filas)
    .partidas.filter((p) => p.tipo === "egreso")
    .map((p) => ({ nombre: p.nombre, usd: Object.values(p.usd).reduce((s, x) => s + x, 0) }));
}

/** Carga los rubros base (con los montos del Excel madre) si el proyecto todavía no tiene presupuesto. */
export async function cargarPlantilla(proyecto: string, por: string): Promise<number> {
  if ((await leerItems(proyecto)).length) return 0;
  const items = plantilla(proyecto, await lineasExcel(proyecto).catch(() => []), por, new Date().toISOString());
  await pestanias().items.agregarVarias(items.map(filaDeItem));
  return items.length;
}

export interface DatosPresupuesto {
  presupuesto: Presupuesto;
  mepHoy: number | null;
  cacHoy: { mes: string; indice: number } | null;
  avisos: string[];
}

/** El presupuesto calculado: los ítems, lo pagado de la caja, el CAC, el MEP y los m² vendibles. */
export async function presupuestoProyecto(id: string, opciones?: { fresco?: boolean }): Promise<DatosPresupuesto> {
  const p = buscarProyecto(id)!;
  const avisos: string[] = [];
  const [items, manuales, caja, serie, hoy, cac, com] = await Promise.all([
    leerItems(id),
    asignacionesManuales(id).catch(() => ({})),
    cajaEgresos(opciones).then((r) => r.caja, (e: unknown) => (avisos.push(`No pude leer las cajas: ${e instanceof Error ? e.message : String(e)}`), null)),
    historicoMep(opciones).then((r) => r.valor, () => (avisos.push("No pude leer el MEP histórico: lo pagado en pesos no se pasa a dólares."), [])),
    dolarHoy(opciones).then((r) => r.valor.cotizaciones.find((c) => c.casa === "mep")?.venta ?? null, () => null),
    serieCac(opciones).then((r) => r.serie, () => (avisos.push("No pude leer el CAC: los presupuestos en pesos no se ajustan."), null)),
    datosComercial(id, opciones).catch(() => null),
  ]);
  const mep = mepDeSerie(serie, hoy);
  const indice = new Map((cac?.meses ?? []).map((m) => [m.mes, m.general.indice]));
  const ultimo = cac?.ultimo ? { mes: cac.ultimo, indice: indice.get(cac.ultimo) ?? 0 } : null;
  const ctx: ContextoPrecios = { cac: (m) => indice.get(m) ?? null, cacHoy: ultimo && ultimo.indice ? ultimo : null, mepHoy: hoy };
  // Los pagos del proyecto (columna "Corresponde"), sin los de HQ ni los sin proyecto.
  const clave = p.nombre.toLowerCase().split(/\s+/)[0];
  const pagos: PagoCaja[] = (caja?.egresos ?? [])
    .filter((e) => e.proyecto.toLowerCase().includes(clave))
    .map((e) => {
      const tc = e.fecha ? mep(e.fecha) : e.mes ? mep(e.mes) : null;
      return { clave: `${e.pestania}:${e.fila}`, fecha: e.fecha, descripcion: e.descripcion || e.categoria, rubro: e.rubro, moneda: e.moneda, monto: e.monto, usd: e.moneda === "USD" ? e.monto : tc ? e.monto / tc : null };
    });
  const m2Venta = com?.desarrolladores?.m2Venta ?? com?.comercial.unidades.filter((u) => !u.esCochera).reduce((s, u) => s + u.supVenta, 0) ?? 0;
  if (!m2Venta) avisos.push("No pude leer los m² vendibles del Excel madre: falta el costo del m².");
  return { presupuesto: calcularPresupuesto(items, pagos, manuales, ctx, m2Venta), mepHoy: hoy, cacHoy: ctx.cacHoy, avisos };
}
