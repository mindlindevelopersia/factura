/**
 * Series mensuales de "Indicadores - REAL ESTATE" (y de fuentes públicas en línea) para comparar
 * índices entre sí: CAC, IPC, dólar, precios de materiales.
 *
 * Todo lo de acá es puro (sin red): los lectores reciben la grilla de cada pestaña o la respuesta
 * de cada fuente. Ver docs/indicadores-panorama.md.
 */

import { mesDeFecha, sumarMeses, type Celda } from "../finanzas/ingresos";
import { mesDeCelda, type SerieCac } from "./cac";

export interface Punto {
  mes: string;
  valor: number;
}

export interface SerieMensual {
  id: string;
  nombre: string;
  /** Para agrupar: "Construcción", "Precios", "Dólar", "Materiales". */
  grupo: string;
  /** Unidad del valor ("índice", "$ por US$", "$ por m3"). */
  unidad: string;
  /** De dónde salió (para mostrarlo). */
  fuente: string;
  puntos: Punto[];
}

export const ultimo = (s: SerieMensual) => s.puntos.at(-1) ?? null;
export const valorEn = (s: SerieMensual, mes: string) => s.puntos.find((p) => p.mes === mes)?.valor ?? null;

/** Ordena, saca repetidos (vale el último) y los valores que no son positivos. */
export function limpiar(puntos: Punto[]): Punto[] {
  const m = new Map<string, number>();
  for (const p of puntos) if (Number.isFinite(p.valor) && p.valor > 0) m.set(p.mes, p.valor);
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([mes, valor]) => ({ mes, valor }));
}

function numero(v: Celda["valor"]): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = v.trim().replace(/\$|\s/g, "");
    // "1.555,16" (es-AR) o "1555.16".
    const n = /,\d+$/.test(t) ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Un mes de una celda de fecha: número de serie, "2015-01-30", "10/25" (mm/aa), "ene-15". */
function mesDe(v: Celda["valor"]): string | null {
  if (typeof v === "string") {
    const mmaa = v.trim().match(/^(\d{1,2})\/(\d{2})$/);
    if (mmaa && Number(mmaa[1]) >= 1 && Number(mmaa[1]) <= 12) return `20${mmaa[2]}-${mmaa[1].padStart(2, "0")}`;
  }
  return mesDeCelda(v) ?? mesDeFecha(v);
}

/** Las tres series del CAC como series mensuales. */
export function seriesDeCac(cac: SerieCac): SerieMensual[] {
  const fuente = "Cámara Argentina de la Construcción (planilla de indicadores)";
  return [
    { id: "cac", nombre: "CAC general", grupo: "Construcción", unidad: "índice", fuente, puntos: cac.meses.map((m) => ({ mes: m.mes, valor: m.general.indice })) },
    { id: "cac-materiales", nombre: "CAC materiales", grupo: "Construcción", unidad: "índice", fuente, puntos: cac.meses.map((m) => ({ mes: m.mes, valor: m.materiales.indice })) },
    { id: "cac-mano", nombre: "CAC mano de obra", grupo: "Construcción", unidad: "índice", fuente, puntos: cac.meses.map((m) => ({ mes: m.mes, valor: m.manoDeObra.indice })) },
  ];
}

/**
 * Pestaña "IPC": fila 1 con los meses (desde "dic-16") y una fila "Nivel general" con el índice.
 * Los títulos de mes se cargaron como fechas raras ("dic-16" quedó como 16/12 del año en curso),
 * así que se toma el primer mes y se cuentan los siguientes de a uno.
 */
export function leerIpc(filas: Celda[][]): Punto[] {
  const fila = filas.find((f) => String(f[0]?.valor ?? "").trim().toLowerCase().replace(/\s+/g, " ") === "nivel general" && f.slice(1).some((c) => typeof c.valor === "number"));
  if (!fila) return [];
  const titulos = filas[0] ?? [];
  let primero: string | null = null;
  const t = titulos[1]?.valor;
  if (typeof t === "number") {
    // Número de serie de "16/12/aaaa": el día es el año (16 → 2016) y el mes, el mes.
    const d = new Date(Date.UTC(1899, 11, 30) + t * 86_400_000);
    primero = `20${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  } else if (typeof t === "string") {
    const iso = t.match(/^\d{4}-(\d{2})-(\d{2})/);
    primero = iso ? `20${iso[2]}-${iso[1]}` : mesDeCelda(t);
  }
  if (!primero) primero = "2016-12";
  const puntos: Punto[] = [];
  for (let i = 1; i < fila.length; i++) {
    const v = numero(fila[i]?.valor ?? null);
    if (v != null) puntos.push({ mes: sumarMeses(primero, i - 1), valor: v });
  }
  return limpiar(puntos);
}

/** Pestañas de tipo de cambio: la tabla "mes a mes" (columna de fecha y la de valor a su derecha). */
export function leerDolarMensual(filas: Celda[][]): Punto[] {
  // La columna "mes a mes" es la que tiene un título "Mensual" / "MES A MES" en las primeras filas.
  let col = -1;
  for (const f of filas.slice(0, 3)) {
    const i = f.findIndex((c) => /mensual|mes a mes/i.test(String(c.valor ?? "")));
    if (i >= 0) col = i;
  }
  if (col < 0) return [];
  const puntos: Punto[] = [];
  for (const f of filas.slice(2)) {
    const mes = mesDe(f[col]?.valor ?? null);
    const v = numero(f[col + 1]?.valor ?? null);
    if (mes && v != null) puntos.push({ mes, valor: v });
  }
  return limpiar(puntos);
}

export interface Insumo {
  id: string;
  descripcion: string;
  unidad: string;
  puntos: Punto[];
}

/** Pestaña "Precios Medios": fila 1 con los meses ("ene.-15"), una fila por insumo (ID, descripción, unidad, precios). */
export function leerPreciosMedios(filas: Celda[][]): Insumo[] {
  const titulos = filas[0] ?? [];
  const meses = titulos.map((c, i) => (i >= 3 ? mesDe(typeof c.valor === "string" ? c.valor.replace(".", "") : c.valor) : null));
  return filas
    .slice(1)
    .filter((f) => f[1]?.valor != null && String(f[1].valor).trim())
    .map((f) => ({
      id: String(f[0]?.valor ?? "").replace(/\.0$/, ""),
      descripcion: String(f[1].valor).trim().replace(/\s+/g, " "),
      unidad: String(f[2]?.valor ?? "").trim(),
      puntos: limpiar(meses.flatMap((mes, i) => (mes && numero(f[i]?.valor ?? null) != null ? [{ mes, valor: numero(f[i].valor)! }] : []))),
    }))
    .filter((i) => i.puntos.length > 0);
}

/** Respuesta de ArgentinaDatos (/v1/cotizaciones/dolares/<casa>): el último valor de venta de cada mes. */
export function dolarDeArgentinaDatos(datos: unknown): Punto[] {
  if (!Array.isArray(datos)) return [];
  const porMes = new Map<string, { fecha: string; valor: number }>();
  for (const d of datos as { fecha?: string; venta?: number }[]) {
    if (typeof d?.fecha !== "string" || typeof d.venta !== "number") continue;
    const mes = d.fecha.slice(0, 7);
    const actual = porMes.get(mes);
    if (!actual || actual.fecha < d.fecha) porMes.set(mes, { fecha: d.fecha, valor: d.venta });
  }
  return limpiar([...porMes].map(([mes, v]) => ({ mes, valor: v.valor })));
}

/** Respuesta de la API de Series de Tiempo (datos.gob.ar): { data: [["2016-12-01", 100], …] }. */
export function serieDeDatosGob(datos: unknown): Punto[] {
  const filas = (datos as { data?: unknown[] })?.data;
  if (!Array.isArray(filas)) return [];
  return limpiar(
    filas.flatMap((f) => (Array.isArray(f) && typeof f[0] === "string" && typeof f[1] === "number" ? [{ mes: f[0].slice(0, 7), valor: f[1] }] : [])),
  );
}

/** De dos versiones de una serie, la que llega más lejos (la otra completa los meses que falten). */
export function combinar(principal: Punto[], respaldo: Punto[]): Punto[] {
  if (!principal.length) return respaldo;
  const meses = new Set(principal.map((p) => p.mes));
  return limpiar([...respaldo.filter((p) => !meses.has(p.mes)), ...principal]);
}

// ---------- Comparaciones ----------

export interface Variacion {
  serie: SerieMensual;
  desde: Punto;
  hasta: Punto;
  variacion: number;
  /** El último dato es anterior al fin del período pedido. */
  incompleta: boolean;
}

/** Variación de una serie en un período: del valor en "desde" (o el primero después) al de "hasta" (o el último antes). */
export function variacion(s: SerieMensual, desde: string, hasta: string): Variacion | null {
  const inicio = s.puntos.find((p) => p.mes >= desde);
  const fin = [...s.puntos].reverse().find((p) => p.mes <= hasta);
  if (!inicio || !fin || fin.mes <= inicio.mes || inicio.mes > sumarMeses(desde, 2)) return null;
  return { serie: s, desde: inicio, hasta: fin, variacion: fin.valor / inicio.valor - 1, incompleta: fin.mes < hasta };
}

/** Las variaciones de todas las series en el período, de mayor a menor. */
export function ranking(series: SerieMensual[], desde: string, hasta: string): Variacion[] {
  return series
    .map((s) => variacion(s, desde, hasta))
    .filter((v): v is Variacion => v != null)
    .sort((a, b) => b.variacion - a.variacion);
}

/**
 * Dos series en el mismo período: si alguna termina antes, las dos se miden hasta ese mes (si no,
 * se compararían períodos distintos).
 */
export function comparar(a: SerieMensual, b: SerieMensual, desde: string, hasta: string): { a: Variacion; b: Variacion; hasta: string; recortado: boolean } | null {
  const fin = (s: SerieMensual) => [...s.puntos].reverse().find((p) => p.mes <= hasta)?.mes;
  const finA = fin(a);
  const finB = fin(b);
  if (!finA || !finB) return null;
  const comun = finA < finB ? finA : finB;
  const va = variacion(a, desde, comun);
  const vb = variacion(b, desde, comun);
  return va && vb ? { a: va, b: vb, hasta: comun, recortado: comun < hasta } : null;
}

/** Cuánto subió una serie por encima (o por debajo) de otra en el período: (1 + a) ÷ (1 + b) − 1. */
export function real(a: Variacion, b: Variacion): number {
  return (1 + a.variacion) / (1 + b.variacion) - 1;
}

/** Los meses del período y cada serie llevada a base 100 en el primero. */
export function base100(series: SerieMensual[], desde: string, hasta: string): { meses: string[]; valores: Record<string, (number | null)[]> } {
  const meses: string[] = [];
  for (let m = desde; m <= hasta; m = sumarMeses(m, 1)) meses.push(m);
  const valores: Record<string, (number | null)[]> = {};
  for (const s of series) {
    const v0 = s.puntos.find((p) => p.mes >= desde && p.mes <= sumarMeses(desde, 2))?.valor;
    valores[s.id] = meses.map((m) => {
      const v = valorEn(s, m);
      return v0 && v != null ? (v / v0) * 100 : null;
    });
  }
  return { meses, valores };
}

/** Una serie pasada a dólares (dividida por el tipo de cambio de cada mes). */
export function enDolares(s: SerieMensual, dolar: SerieMensual, id = `${s.id}-usd`): SerieMensual {
  return {
    ...s,
    id,
    nombre: `${s.nombre} en dólares`,
    unidad: "US$",
    puntos: s.puntos.flatMap((p) => {
      const d = valorEn(dolar, p.mes);
      return d ? [{ mes: p.mes, valor: p.valor / d }] : [];
    }),
  };
}
