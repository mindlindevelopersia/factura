/**
 * Índice CAC: el indicador de la Cámara Argentina de la Construcción (costo de un edificio tipo en
 * Capital Federal, base 100 = diciembre 2014), con sus tres series: costo de construcción, materiales
 * y mano de obra.
 *
 * Se lee de la pestaña "Índice CAC" de la planilla "Indicadores - REAL ESTATE", la misma que usan
 * las fórmulas del Flujo de fondos. Cada mes son tres filas seguidas (Costo de Construcción,
 * Materiales, Mano de Obra) y la fecha está en una de ellas. Ver docs/indicadores-cac.md.
 *
 * Las variaciones se calculan de los índices; las de la planilla solo se usan para controlar.
 * Todo lo de acá es puro (sin red): lo usan la ruta de la API, la pantalla, Cobranzas y los tests.
 */

import { mesDeFecha, sumarMeses, type Celda } from "../finanzas/ingresos";

export type Serie = "general" | "materiales" | "manoDeObra";

export const SERIES: { id: Serie; nombre: string }[] = [
  { id: "general", nombre: "Costo de Construcción" },
  { id: "materiales", nombre: "Materiales" },
  { id: "manoDeObra", nombre: "Mano de Obra" },
];

export interface ValorSerie {
  indice: number;
  /** Respecto del mes anterior. Null en el primer mes de la serie. */
  mensual: number | null;
  /** Respecto de diciembre del año anterior. */
  anual: number | null;
  /** Respecto del mismo mes del año anterior. */
  interanual: number | null;
}

export interface MesCac {
  /** "2026-09". */
  mes: string;
  general: ValorSerie;
  materiales: ValorSerie;
  manoDeObra: ValorSerie;
  /** Los últimos tres meses publicados: la Cámara los marca con (*) porque todavía pueden corregirse. */
  provisorio: boolean;
  /** Fila de la planilla donde empieza el mes ("Costo de Construcción"). */
  fila: number;
}

export interface AvisoCac {
  titulo: string;
  detalle: string;
  filas: number[];
}

export interface SerieCac {
  meses: MesCac[];
  avisos: AvisoCac[];
  /** El último mes publicado. */
  ultimo: string | null;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function normalizar(t: unknown): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** "ene-15", "Ene 2026", número de serie o fecha → "2015-01". */
export function mesDeCelda(valor: Celda["valor"]): string | null {
  if (typeof valor === "string") {
    const m = normalizar(valor).match(/^([a-z]{3})[a-z]*[\s.-]*(\d{2}|\d{4})$/);
    if (m) {
      const i = MESES_CORTOS.indexOf(m[1] === "set" ? "sep" : m[1]);
      if (i >= 0) return `${m[2].length === 2 ? `20${m[2]}` : m[2]}-${String(i + 1).padStart(2, "0")}`;
    }
  }
  return mesDeFecha(valor);
}

function serieDe(denominacion: unknown): Serie | null {
  const d = normalizar(denominacion);
  if (d.startsWith("costo")) return "general";
  if (d.startsWith("material")) return "materiales";
  if (d.startsWith("mano")) return "manoDeObra";
  return null;
}

/**
 * Lee la pestaña "Índice CAC": columna A el período, B la denominación, C el índice, D la variación
 * mensual y E la acumulada anual (D y E solo para controlar). Los meses sin publicar (índice vacío,
 * con error o igual al del mes anterior en las tres series) se descartan.
 */
export function leerCac(filas: Celda[][]): SerieCac {
  type Crudo = { mes: string | null; fila: number; indices: Partial<Record<Serie, number>>; planilla: Partial<Record<Serie, number>> };
  const grupos: Crudo[] = [];
  let actual: Crudo | null = null;

  filas.forEach((fila, i) => {
    const serie = serieDe(fila[1]?.valor);
    if (!serie) return;
    if (serie === "general" || !actual) {
      actual = { mes: null, fila: i + 1, indices: {}, planilla: {} };
      grupos.push(actual);
    }
    actual.mes ??= mesDeCelda(fila[0]?.valor ?? null);
    const indice = fila[2]?.valor;
    if (typeof indice === "number" && indice > 0) actual.indices[serie] = indice;
    const variacion = fila[3]?.valor;
    if (typeof variacion === "number") actual.planilla[serie] = variacion;
  });

  // Solo los meses con las tres series, sin repetir y en orden.
  const porMes = new Map<string, Crudo>();
  for (const g of grupos) {
    if (!g.mes || g.indices.general == null || g.indices.materiales == null || g.indices.manoDeObra == null) continue;
    porMes.set(g.mes, g);
  }
  const ordenados = [...porMes.values()].sort((a, b) => a.mes!.localeCompare(b.mes!));
  // Un mes idéntico al anterior en las tres series es una copia: todavía no se publicó.
  const publicados = ordenados.filter((g, i) => {
    const prev = ordenados[i - 1];
    return !prev || SERIES.some((s) => g.indices[s.id] !== prev.indices[s.id]);
  });

  const indice = new Map(publicados.map((g) => [g.mes!, g.indices]));
  const variacion = (mes: string, otro: string, s: Serie) => {
    const a = indice.get(mes)?.[s];
    const b = indice.get(otro)?.[s];
    return a != null && b != null ? a / b - 1 : null;
  };

  const meses: MesCac[] = publicados.map((g, i) => {
    const mes = g.mes!;
    const valor = (s: Serie): ValorSerie => ({
      indice: g.indices[s]!,
      mensual: variacion(mes, sumarMeses(mes, -1), s),
      anual: variacion(mes, `${Number(mes.slice(0, 4)) - 1}-12`, s),
      interanual: variacion(mes, sumarMeses(mes, -12), s),
    });
    return { mes, general: valor("general"), materiales: valor("materiales"), manoDeObra: valor("manoDeObra"), provisorio: i >= publicados.length - 3, fila: g.fila };
  });

  const avisos: AvisoCac[] = [];
  // Huecos: meses que faltan entre el primero y el último.
  const faltan: string[] = [];
  for (let m = meses[0]?.mes; m && m < meses.at(-1)!.mes; m = sumarMeses(m, 1)) if (!indice.has(m)) faltan.push(m);
  if (faltan.length) {
    avisos.push({ titulo: "Meses que faltan en la serie", detalle: `${faltan.join(", ")}. Las variaciones de los meses siguientes no se pueden calcular.`, filas: [] });
  }
  // La variación escrita en la planilla contra la que sale de los índices (las viejas vienen redondeadas a 0,1%).
  const distintas = publicados.filter((g) =>
    SERIES.some((s) => {
      const calculada = variacion(g.mes!, sumarMeses(g.mes!, -1), s.id);
      const escrita = g.planilla[s.id];
      return calculada != null && escrita != null && Math.abs(calculada - escrita) > 0.0015;
    }),
  );
  if (distintas.length) {
    avisos.push({
      titulo: "Variaciones de la planilla que no coinciden con los índices",
      detalle: `${distintas.map((g) => g.mes).join(", ")}. Puede ser un índice corregido por la Cámara y no actualizado, o una fórmula mal copiada. Este módulo usa la variación que sale de los índices.`,
      filas: distintas.map((g) => g.fila),
    });
  }

  return { meses, avisos, ultimo: meses.at(-1)?.mes ?? null };
}

/**
 * Actualiza un monto por CAC entre dos meses: monto × índice(hasta) ÷ índice(desde).
 * Si "hasta" todavía no se publicó, usa el último publicado (y lo dice).
 */
export function actualizar(serie: SerieCac, monto: number, desde: string, hasta: string, cual: Serie = "general") {
  const buscar = (mes: string) => serie.meses.find((m) => m.mes === mes);
  const inicio = buscar(desde);
  const fin = buscar(hasta) ?? (serie.ultimo && hasta > serie.ultimo ? buscar(serie.ultimo) : undefined);
  if (!inicio || !fin) return null;
  const factor = fin[cual].indice / inicio[cual].indice;
  return { monto: monto * factor, factor, desde: inicio.mes, hasta: fin.mes, indiceDesde: inicio[cual].indice, indiceHasta: fin[cual].indice, usoUltimo: fin.mes !== hasta };
}

/** Los meses de un rango (o los últimos n), en orden. */
export function rango(serie: SerieCac, desde: string | null, hasta: string | null): MesCac[] {
  return serie.meses.filter((m) => (!desde || m.mes >= desde) && (!hasta || m.mes <= hasta));
}

/** La serie en CSV para Excel en español. */
export function cacACsv(meses: MesCac[]): string {
  const pct = (n: number | null) => (n == null ? "" : (n * 100).toFixed(2).replace(".", ","));
  const filas = [
    ["Período", "Denominación", "Índice (base 100 dic. 2014)", "Variación mes anterior %", "Acumulado anual %", "Interanual %", "Provisorio"],
    ...meses.flatMap((m) =>
      SERIES.map((s) => [m.mes, s.nombre, m[s.id].indice.toFixed(1).replace(".", ","), pct(m[s.id].mensual), pct(m[s.id].anual), pct(m[s.id].interanual), m.provisorio ? "Sí" : ""]),
    ),
  ];
  return "﻿" + filas.map((f) => f.join(";")).join("\r\n");
}
