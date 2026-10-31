/**
 * ¿Es momento de comprar (acopiar) un material? Compara el precio de hoy con su propia historia,
 * en términos reales, como lo armó Tadeo en "Indicadores - REAL ESTATE":
 * - "A valores de hoy": precio × CAC de su último mes ÷ CAC del mes (si subió menos que la
 *   construcción, está relativamente barato).
 * - En dólares blue: precio ÷ dólar blue del mes.
 * La señal sale de en qué parte de su historia está el precio de hoy (percentil) en las dos medidas.
 *
 * Todo lo de acá es puro (sin red). Ver docs/indicadores-materiales.md.
 */

import { sumarMeses } from "../finanzas/ingresos";
import { valorEn, type Insumo, type Punto, type SerieMensual } from "./series";

export type Senal = "comprar" | "normal" | "esperar";
/** El resumen de las dos lecturas: si no coinciden, depende de con qué plata se compre. */
export type Resumen = Senal | "depende";

export interface Medida {
  /** El valor del último mes en esta medida. */
  actual: number;
  /** De 0 a 1: qué parte de la historia estuvo más barata que hoy. */
  percentil: number;
  mediana: number;
  /** Hoy contra la mediana: −0,2 = 20% más barato que lo habitual. */
  vsMediana: number;
  minimo: Punto;
  maximo: Punto;
  serie: Punto[];
}

export interface AnalisisMaterial {
  id: string;
  descripcion: string;
  unidad: string;
  ultimoMes: string;
  precio: number;
  /** Precio llevado al último CAC publicado. */
  real: Medida | null;
  usd: Medida | null;
  /** Comprando con pesos que se ajustan por CAC (como las cuotas): el precio contra el CAC. */
  senalPesos: Senal | null;
  /** Comprando con dólares: el precio en dólares blue. */
  senalDolares: Senal | null;
  resumen: Resumen | null;
  /** Explicación en una frase. */
  motivo: string;
  /** Meses de atraso del último precio respecto del último CAC. */
  atraso: number;
}

/** Los materiales que se muestran primero (y en el Panorama). */
export const DESTACADOS = ["142001", "4001"]; // Hormigón H30 y hierro de 12 mm.

/** Desde cuándo se mira la historia (los primeros años tienen precios de otra economía). */
export const ANIOS_HISTORIA = 6;
/** Umbrales de la señal, sobre el promedio de los dos percentiles. */
export const UMBRAL_BARATO = 0.25;
export const UMBRAL_CARO = 0.75;

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function medida(serie: Punto[]): Medida | null {
  if (serie.length < 12) return null;
  const actual = serie.at(-1)!.valor;
  const valores = serie.map((p) => p.valor);
  const med = mediana(valores);
  const ordenados = [...serie].sort((a, b) => a.valor - b.valor);
  return {
    actual,
    percentil: valores.filter((v) => v < actual).length / (valores.length - 1 || 1),
    mediana: med,
    vsMediana: actual / med - 1,
    minimo: ordenados[0],
    maximo: ordenados.at(-1)!,
    serie,
  };
}

const pct = (n: number) => `${Math.round(Math.abs(n) * 100)}%`;

/**
 * Analiza un insumo contra su historia. cac: el índice general; dolar: el blue mensual.
 * mesCac: el último CAC publicado (para medir el atraso del precio).
 */
export function analizar(insumo: Insumo, cac: SerieMensual, dolar: SerieMensual | null): AnalisisMaterial | null {
  const ult = insumo.puntos.at(-1);
  if (!ult) return null;
  const desde = sumarMeses(ult.mes, -12 * ANIOS_HISTORIA);
  const historia = insumo.puntos.filter((p) => p.mes >= desde);
  const cacUltimo = valorEn(cac, ult.mes);
  const real = cacUltimo
    ? medida(
        historia.flatMap((p) => {
          const c = valorEn(cac, p.mes);
          return c ? [{ mes: p.mes, valor: (p.valor * cacUltimo) / c }] : [];
        }),
      )
    : null;
  const usd = dolar
    ? medida(
        historia.flatMap((p) => {
          const d = valorEn(dolar, p.mes);
          return d ? [{ mes: p.mes, valor: p.valor / d }] : [];
        }),
      )
    : null;
  // Si a una medida le falta el último mes (por ejemplo, no hay dólar de ese mes), no vale para la señal.
  const vigente = (m: Medida | null) => (m && m.serie.at(-1)!.mes === ult.mes ? m : null);
  const senalDe = (m: Medida | null): Senal | null => (!m ? null : m.percentil <= UMBRAL_BARATO ? "comprar" : m.percentil >= UMBRAL_CARO ? "esperar" : "normal");
  const senalPesos = senalDe(vigente(real));
  const senalDolares = senalDe(vigente(usd));
  const resumen: Resumen | null =
    senalPesos && senalDolares ? (senalPesos === senalDolares ? senalPesos : senalPesos === "normal" ? senalDolares : senalDolares === "normal" ? senalPesos : "depende") : (senalPesos ?? senalDolares);

  const lectura = (m: Medida | null, como: string) => (m ? `${como}, ${pct(m.vsMediana)} ${m.vsMediana < 0 ? "por debajo" : "por encima"} de lo habitual` : null);
  const partes = [lectura(vigente(real), "con pesos ajustados por CAC"), lectura(vigente(usd), "en dólares blue")].filter(Boolean);
  const caroOBarato = (s: Senal | null) => (s === "comprar" ? "está barato" : "está caro");
  const motivo =
    resumen == null
      ? "No hay datos suficientes para comparar."
      : resumen === "depende"
        ? `Si se compra con pesos que vienen de cuotas ajustadas por CAC, ${caroOBarato(senalPesos)}; si se compra con dólares, ${caroOBarato(senalDolares)}.`
        : `${TEXTO_SENAL[resumen]}: ${partes.join("; ")} (últimos ${ANIOS_HISTORIA} años).`;

  const ultimoCac = cac.puntos.at(-1)?.mes ?? ult.mes;
  const [a1, m1] = ultimoCac.split("-").map(Number);
  const [a2, m2] = ult.mes.split("-").map(Number);
  return {
    id: insumo.id,
    descripcion: insumo.descripcion,
    unidad: insumo.unidad,
    ultimoMes: ult.mes,
    precio: ult.valor,
    real,
    usd,
    senalPesos,
    senalDolares,
    resumen,
    motivo,
    atraso: Math.max(0, (a1 - a2) * 12 + (m1 - m2)),
  };
}

/** Todos los insumos analizados: primero los destacados, después los más baratos. */
export function analizarTodos(insumos: Insumo[], cac: SerieMensual, dolar: SerieMensual | null): AnalisisMaterial[] {
  const orden = (a: AnalisisMaterial) => {
    const d = DESTACADOS.indexOf(a.id);
    return d >= 0 ? d - 100 : (a.usd?.percentil ?? a.real?.percentil ?? 2);
  };
  return insumos
    .map((i) => analizar(i, cac, dolar))
    .filter((a): a is AnalisisMaterial => a != null)
    .sort((a, b) => orden(a) - orden(b));
}

export const TEXTO_SENAL: Record<Resumen, string> = {
  comprar: "Buen momento para comprar",
  normal: "Precio normal",
  esperar: "Caro: mejor esperar",
  depende: "Depende de con qué plata se compre",
};
