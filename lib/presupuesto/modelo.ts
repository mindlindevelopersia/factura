/**
 * El presupuesto de obra (base 0) contra lo real.
 *
 * Por ítem: el presupuesto (en dólares, o en pesos con su mes base de CAC para actualizarlo), lo
 * pagado (los pagos de la caja de egresos que van a ese ítem, en dólares al MEP del día), lo que
 * falta (presupuesto − pagado, o un número a mano) y el costo final estimado (pagado + falta).
 * La suma da el costo total del proyecto y el costo del m².
 *
 * Los pesos se llevan a hoy con el CAC general (mes base → último publicado) y se pasan a dólares
 * al MEP de hoy. Puro.
 */

import { GRUPOS_PRESUPUESTO, grupoDeRubroCaja, RUBROS_BASE, type GrupoPresupuesto } from "./rubros";

export type MonedaPresupuesto = "USD" | "ARS";
export const ESTADOS_ITEM = ["estimado", "cotizado", "contratado"] as const;
export type EstadoItem = (typeof ESTADOS_ITEM)[number];
export const NOMBRE_ESTADO: Record<EstadoItem, string> = { estimado: "Estimado", cotizado: "Cotizado", contratado: "Contratado" };

export interface ItemPresupuesto {
  id: string;
  proyecto: string;
  grupo: GrupoPresupuesto;
  nombre: string;
  orden: number;
  moneda: MonedaPresupuesto;
  /** Lo presupuestado del ítem completo; null si todavía no se cargó. */
  monto: number | null;
  /** Para los pesos: el mes del presupuesto ("2026-09"), para ajustarlo por CAC. */
  baseCac: string | null;
  proveedor: string;
  estado: EstadoItem;
  /** Lo que falta, puesto a mano (en dólares). Null: presupuesto − pagado. */
  faltaUsd: number | null;
  notas: string;
  actualizado: string;
  por: string;
}

export interface PagoCaja {
  /** "Caja Flujos en Pesos:123": la pestaña y la fila, para asignarlo a mano. */
  clave: string;
  fecha: string | null;
  descripcion: string;
  rubro: string;
  moneda: MonedaPresupuesto;
  monto: number;
  /** En dólares al MEP del día (null si no hay MEP). */
  usd: number | null;
}

export interface ContextoPrecios {
  /** El índice CAC general de un mes ("2026-09"), o null si no está. */
  cac: (mes: string) => number | null;
  /** El último CAC publicado. */
  cacHoy: { mes: string; indice: number } | null;
  mepHoy: number | null;
}

export const normalizarTexto = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** El presupuesto de un ítem llevado a hoy y a dólares. */
export function presupuestoHoy(i: Pick<ItemPresupuesto, "moneda" | "monto" | "baseCac">, ctx: ContextoPrecios): { usd: number | null; arsAjustado: number | null; factorCac: number | null } {
  if (i.monto == null) return { usd: null, arsAjustado: null, factorCac: null };
  if (i.moneda === "USD") return { usd: i.monto, arsAjustado: null, factorCac: null };
  const base = i.baseCac ? ctx.cac(i.baseCac) : null;
  const factorCac = base && ctx.cacHoy ? ctx.cacHoy.indice / base : null;
  const arsAjustado = i.monto * (factorCac ?? 1);
  return { usd: ctx.mepHoy ? arsAjustado / ctx.mepHoy : null, arsAjustado, factorCac };
}

const BASE_POR_ID = new Map(RUBROS_BASE.map((r) => [r.id, r]));

/**
 * A qué ítem va un pago de la caja: el elegido a mano; si no, el primer ítem cuyas palabras
 * aparecen en la descripción; si no, el ítem que toma ese rubro de la caja; si no, a ninguno.
 */
export function asignarPago(p: Pick<PagoCaja, "clave" | "descripcion" | "rubro">, items: Pick<ItemPresupuesto, "id">[], manuales: Record<string, string>): string | null {
  const ids = new Set(items.map((i) => i.id));
  const manual = manuales[p.clave];
  if (manual !== undefined) return manual && ids.has(manual) ? manual : null;
  const d = normalizarTexto(p.descripcion);
  for (const i of items) if (BASE_POR_ID.get(i.id)?.claves?.test(d)) return i.id;
  for (const i of items) if (BASE_POR_ID.get(i.id)?.rubrosCaja?.includes(p.rubro)) return i.id;
  return null;
}

export interface ItemCalculado extends ItemPresupuesto {
  presupuestoUsd: number | null;
  arsAjustado: number | null;
  factorCac: number | null;
  pagadoUsd: number;
  pagos: PagoCaja[];
  faltaCalculadaUsd: number;
  costoFinalUsd: number;
  /** Costo final − presupuesto (positivo: se pasa). Null sin presupuesto. */
  desvioUsd: number | null;
}

export interface TotalesPresupuesto {
  presupuestoUsd: number;
  pagadoUsd: number;
  faltaUsd: number;
  costoFinalUsd: number;
  /** Pagado que no se pudo asignar a un ítem (se suma igual al costo). */
  sinItemUsd: number;
}

export interface Presupuesto {
  items: ItemCalculado[];
  grupos: ({ id: GrupoPresupuesto; nombre: string; detalle: string; sinItem: PagoCaja[] } & TotalesPresupuesto)[];
  total: TotalesPresupuesto;
  /** Ítems sin monto cargado. */
  sinPresupuesto: number;
  /** Pagos sin MEP del día (no suman en dólares). */
  sinMep: number;
  m2Venta: number;
  costoM2: number;
}

const cero = (): TotalesPresupuesto => ({ presupuestoUsd: 0, pagadoUsd: 0, faltaUsd: 0, costoFinalUsd: 0, sinItemUsd: 0 });

export function calcularPresupuesto(items: ItemPresupuesto[], pagos: PagoCaja[], manuales: Record<string, string>, ctx: ContextoPrecios, m2Venta: number): Presupuesto {
  const ordenados = [...items].sort((a, b) => GRUPOS_PRESUPUESTO.findIndex((g) => g.id === a.grupo) - GRUPOS_PRESUPUESTO.findIndex((g) => g.id === b.grupo) || a.orden - b.orden);
  const porItem = new Map<string, PagoCaja[]>();
  const sinItem = new Map<GrupoPresupuesto, PagoCaja[]>();
  for (const p of pagos) {
    const id = asignarPago(p, ordenados, manuales);
    if (id) (porItem.get(id) ?? porItem.set(id, []).get(id)!).push(p);
    else {
      const g = grupoDeRubroCaja(p.rubro);
      (sinItem.get(g) ?? sinItem.set(g, []).get(g)!).push(p);
    }
  }
  const suma = (ps: PagoCaja[]) => ps.reduce((s, p) => s + (p.usd ?? 0), 0);
  const calculados: ItemCalculado[] = ordenados.map((i) => {
    const hoy = presupuestoHoy(i, ctx);
    const ps = (porItem.get(i.id) ?? []).sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
    const pagadoUsd = suma(ps);
    const faltaCalculadaUsd = i.faltaUsd ?? Math.max(0, (hoy.usd ?? 0) - pagadoUsd);
    const costoFinalUsd = pagadoUsd + faltaCalculadaUsd;
    return { ...i, presupuestoUsd: hoy.usd, arsAjustado: hoy.arsAjustado, factorCac: hoy.factorCac, pagadoUsd, pagos: ps, faltaCalculadaUsd, costoFinalUsd, desvioUsd: hoy.usd == null ? null : costoFinalUsd - hoy.usd };
  });
  const sumar = (t: TotalesPresupuesto, i: ItemCalculado) => {
    t.presupuestoUsd += i.presupuestoUsd ?? 0;
    t.pagadoUsd += i.pagadoUsd;
    t.faltaUsd += i.faltaCalculadaUsd;
    t.costoFinalUsd += i.costoFinalUsd;
  };
  const total = cero();
  const grupos = GRUPOS_PRESUPUESTO.map((g) => {
    const t = cero();
    for (const i of calculados.filter((x) => x.grupo === g.id)) sumar(t, i);
    const sueltos = (sinItem.get(g.id) ?? []).sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
    t.sinItemUsd = suma(sueltos);
    t.pagadoUsd += t.sinItemUsd;
    t.costoFinalUsd += t.sinItemUsd;
    for (const k of Object.keys(t) as (keyof TotalesPresupuesto)[]) total[k] += t[k];
    return { id: g.id, nombre: g.nombre, detalle: g.detalle, sinItem: sueltos, ...t };
  });
  return {
    items: calculados,
    grupos,
    total,
    sinPresupuesto: calculados.filter((i) => i.monto == null).length,
    sinMep: pagos.filter((p) => p.usd == null).length,
    m2Venta,
    costoM2: m2Venta > 0 ? total.costoFinalUsd / m2Venta : 0,
  };
}

/**
 * La plantilla para arrancar: los rubros base, con el monto del cash flow del Excel madre cuando
 * hay una línea que les corresponde (en dólares, como "estimado").
 */
export function plantilla(proyecto: string, lineasExcel: { nombre: string; usd: number }[], por: string, ahora: string): ItemPresupuesto[] {
  const excel = new Map(lineasExcel.map((l) => [normalizarTexto(l.nombre).replace(/\s+/g, " ").trim(), l.usd]));
  return RUBROS_BASE.map((r, n) => {
    const montos = (r.delExcel ?? []).map((x) => excel.get(normalizarTexto(x).replace(/\s+/g, " ").trim())).filter((x): x is number => x != null);
    const monto = montos.length ? Math.round(montos.reduce((s, x) => s + x, 0)) : null;
    return {
      id: r.id,
      proyecto,
      grupo: r.grupo,
      nombre: r.nombre,
      orden: n + 1,
      moneda: "USD",
      monto,
      baseCac: null,
      proveedor: "",
      estado: "estimado",
      faltaUsd: null,
      notas: monto != null ? "Monto inicial del cash flow del Excel madre." : "",
      actualizado: ahora,
      por,
    };
  });
}

/** Revisa lo que llega para crear o cambiar un ítem. */
export function validarItem(x: unknown): { error: string } | { cambios: Partial<ItemPresupuesto> } {
  const o = (x ?? {}) as Record<string, unknown>;
  const c: Partial<ItemPresupuesto> = {};
  if (o.nombre !== undefined) {
    const n = String(o.nombre).trim().slice(0, 120);
    if (!n) return { error: "El ítem necesita un nombre." };
    c.nombre = n;
  }
  if (o.grupo !== undefined) {
    if (!GRUPOS_PRESUPUESTO.some((g) => g.id === o.grupo)) return { error: "Rubro inválido." };
    c.grupo = o.grupo as GrupoPresupuesto;
  }
  if (o.moneda !== undefined) {
    if (o.moneda !== "USD" && o.moneda !== "ARS") return { error: "Moneda inválida." };
    c.moneda = o.moneda;
  }
  const numero = (v: unknown) => (v === null || v === "" ? null : typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : NaN);
  if (o.monto !== undefined) {
    const n = numero(o.monto);
    if (Number.isNaN(n)) return { error: "El monto no es un número válido." };
    c.monto = n;
  }
  if (o.faltaUsd !== undefined) {
    const n = numero(o.faltaUsd);
    if (Number.isNaN(n)) return { error: "Lo que falta no es un número válido." };
    c.faltaUsd = n;
  }
  if (o.baseCac !== undefined) {
    if (o.baseCac && !/^\d{4}-\d{2}$/.test(String(o.baseCac))) return { error: "El mes base del CAC no es válido." };
    c.baseCac = o.baseCac ? String(o.baseCac) : null;
  }
  if (o.estado !== undefined) {
    if (!(ESTADOS_ITEM as readonly string[]).includes(String(o.estado))) return { error: "Estado inválido." };
    c.estado = o.estado as EstadoItem;
  }
  if (o.proveedor !== undefined) c.proveedor = String(o.proveedor).slice(0, 120);
  if (o.notas !== undefined) c.notas = String(o.notas).slice(0, 2000);
  if (o.orden !== undefined && Number.isFinite(Number(o.orden))) c.orden = Number(o.orden);
  return { cambios: c };
}

// ——— Filas de la planilla ———
export const COLUMNAS_PRESUPUESTO = ["Proyecto", "ID", "Rubro", "Ítem", "Orden", "Moneda", "Monto", "Mes base CAC", "Proveedor", "Estado", "Falta (USD, a mano)", "Notas", "Actualizado", "Por"] as const;
const num = (t: string | undefined) => (t == null || t === "" ? null : Number(t));
export const filaDeItem = (i: ItemPresupuesto) => [i.proyecto, i.id, i.grupo, i.nombre, String(i.orden), i.moneda, i.monto == null ? "" : String(i.monto), i.baseCac ?? "", i.proveedor, i.estado, i.faltaUsd == null ? "" : String(i.faltaUsd), i.notas, i.actualizado, i.por];
export const itemDeFila = (f: string[]): ItemPresupuesto => ({
  proyecto: f[0] ?? "",
  id: f[1] ?? "",
  grupo: (GRUPOS_PRESUPUESTO.some((g) => g.id === f[2]) ? f[2] : "hard") as GrupoPresupuesto,
  nombre: f[3] ?? "",
  orden: Number(f[4]) || 0,
  moneda: f[5] === "ARS" ? "ARS" : "USD",
  monto: num(f[6]),
  baseCac: f[7] || null,
  proveedor: f[8] ?? "",
  estado: (ESTADOS_ITEM as readonly string[]).includes(f[9] ?? "") ? (f[9] as EstadoItem) : "estimado",
  faltaUsd: num(f[10]),
  notas: f[11] ?? "",
  actualizado: f[12] ?? "",
  por: f[13] ?? "",
});
