/**
 * La propuesta comercial de una unidad, como la que se le armó a Virginia (2C, ficha de Ventas):
 * el valor en dólares se pasa a pesos al MEP del día y se parte en A (boleto, formal) y B (compromiso,
 * informal). Cada parte tiene un anticipo en dólares; el saldo de A se paga en cuotas mensuales y
 * refuerzos (un porcentaje del total en pesos) y el de B en refuerzos. Las cuotas se ajustan por CAC
 * desde el mes base. Todo puro (sin red).
 */

import { nombreMes, sumarMeses } from "../finanzas/ingresos";

export interface RefuerzoA {
  /** "2026-12". */
  mes: string;
  /** Parte del total en pesos (0,2 = 20%). */
  porcentaje: number;
}

export interface ParametrosPropuesta {
  cliente: string;
  unidad: string;
  precioUsd: number;
  /** Pesos por dólar (MEP del día). */
  tipoCambio: number;
  /** Desde dónde se ajusta por CAC ("2026-09"). */
  mesBaseCac: string;
  /** Parte A (formal) del total, de 0 a 1. */
  formal: number;
  anticipoAUsd: number;
  anticipoBUsd: number;
  cuotas: { cantidad: number; desde: string };
  refuerzosA: RefuerzoA[];
  /** Meses de los refuerzos de B: el saldo de B se reparte en partes iguales. */
  refuerzosB: string[];
  /** "2026-11-01". */
  fecha: string;
  vigenciaDias: number;
  /** Mostrar la parte B en la propuesta (si no, va solo el total y lo formal). */
  mostrarB: boolean;
}

export interface Pago {
  /** "2026-12", o null para el anticipo a la firma. */
  mes: string | null;
  concepto: string;
  parte: "A" | "B";
  moneda: "USD" | "ARS";
  monto: number;
}

export interface Parte {
  porcentaje: number;
  usd: number;
  ars: number;
  anticipoUsd: number;
  anticipoArs: number;
  saldoArs: number;
}

export interface Propuesta {
  totalArs: number;
  A: Parte & { cuotaArs: number; refuerzos: { mes: string; ars: number; porcentaje: number }[] };
  B: Parte & { refuerzos: { mes: string; ars: number }[] };
  cronograma: Pago[];
  /** Algo que no cierra (el saldo de A no alcanza para los refuerzos, etc.). */
  problemas: string[];
  hasta: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularPropuesta(p: ParametrosPropuesta): Propuesta {
  const problemas: string[] = [];
  const totalArs = p.precioUsd * p.tipoCambio;
  const parte = (porcentaje: number, anticipoUsd: number): Parte => {
    const usd = p.precioUsd * porcentaje;
    const ars = usd * p.tipoCambio;
    const anticipoArs = anticipoUsd * p.tipoCambio;
    return { porcentaje, usd, ars, anticipoUsd, anticipoArs, saldoArs: ars - anticipoArs };
  };
  const a = parte(p.formal, p.anticipoAUsd);
  const b = parte(1 - p.formal, p.anticipoBUsd);
  const refuerzosA = p.refuerzosA.filter((r) => r.mes && r.porcentaje > 0).map((r) => ({ mes: r.mes, porcentaje: r.porcentaje, ars: r2(totalArs * r.porcentaje) }));
  const enRefuerzos = refuerzosA.reduce((s, r) => s + r.ars, 0);
  const cuotas = Math.max(0, Math.round(p.cuotas.cantidad));
  const paraCuotas = a.saldoArs - enRefuerzos;
  if (paraCuotas < 0) problemas.push("Los refuerzos de A suman más que el saldo de A: bajá los porcentajes.");
  if (a.saldoArs < 0) problemas.push("El anticipo de A es mayor que la parte A.");
  if (b.saldoArs < 0) problemas.push("El anticipo de B es mayor que la parte B.");
  if (cuotas === 0 && paraCuotas > 1) problemas.push("Sin cuotas, el saldo de A tiene que salir de los refuerzos.");
  const cuotaArs = cuotas ? r2(Math.max(0, paraCuotas) / cuotas) : 0;
  const mesesB = p.refuerzosB.filter(Boolean);
  if (!mesesB.length && b.saldoArs > 1) problemas.push("Falta el refuerzo de B para pagar su saldo.");
  const refuerzosB = mesesB.map((mes) => ({ mes, ars: r2(Math.max(0, b.saldoArs) / mesesB.length) }));

  const cronograma: Pago[] = [];
  if (a.anticipoUsd) cronograma.push({ mes: null, concepto: "Anticipo A (a la firma)", parte: "A", moneda: "USD", monto: a.anticipoUsd });
  if (b.anticipoUsd) cronograma.push({ mes: null, concepto: "Anticipo B (a la firma)", parte: "B", moneda: "USD", monto: b.anticipoUsd });
  for (let i = 0; i < cuotas; i++) cronograma.push({ mes: sumarMeses(p.cuotas.desde, i), concepto: `Cuota ${i + 1} de ${cuotas}`, parte: "A", moneda: "ARS", monto: cuotaArs });
  refuerzosA.forEach((r, i) => cronograma.push({ mes: r.mes, concepto: `Refuerzo A${refuerzosA.length > 1 ? ` ${i + 1}` : ""}`, parte: "A", moneda: "ARS", monto: r.ars }));
  refuerzosB.forEach((r, i) => cronograma.push({ mes: r.mes, concepto: `Refuerzo B${refuerzosB.length > 1 ? ` ${i + 1}` : ""}`, parte: "B", moneda: "ARS", monto: r.ars }));
  cronograma.sort((x, y) => (x.mes ?? "").localeCompare(y.mes ?? ""));

  const d = new Date(`${p.fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + p.vigenciaDias);
  return {
    totalArs,
    A: { ...a, cuotaArs, refuerzos: refuerzosA },
    B: { ...b, refuerzos: refuerzosB },
    cronograma,
    problemas,
    hasta: d.toISOString().slice(0, 10),
  };
}

/** El mes de entrega estimado de cada proyecto (hasta ahí van las cuotas de la propuesta). */
export const ENTREGA: Record<string, string> = { "lerma-439": "2028-04" };

/** Los valores de partida (los de la propuesta de Virginia): 70/30, anticipos de US$ 1.000 y 10.000, cuotas hasta la entrega, dos refuerzos de A del 20% y uno de B. */
export function parametrosIniciales(o: { cliente: string; unidad: string; precioUsd: number; tipoCambio: number; hoy: string; entrega: string }): ParametrosPropuesta {
  const mes = o.hoy.slice(0, 7);
  const desde = sumarMeses(mes, 1);
  const diciembre = `${mes.slice(0, 4)}-12` > mes ? `${mes.slice(0, 4)}-12` : `${Number(mes.slice(0, 4)) + 1}-12`;
  let cantidad = 1;
  while (sumarMeses(desde, cantidad) <= o.entrega) cantidad++;
  return {
    cliente: o.cliente,
    unidad: o.unidad,
    precioUsd: Math.round(o.precioUsd),
    tipoCambio: Math.round(o.tipoCambio),
    mesBaseCac: sumarMeses(mes, -1),
    formal: 0.7,
    anticipoAUsd: 1000,
    anticipoBUsd: 10000,
    cuotas: { cantidad, desde },
    refuerzosA: [
      { mes: diciembre, porcentaje: 0.2 },
      { mes: sumarMeses(diciembre, 12), porcentaje: 0.2 },
    ],
    refuerzosB: [diciembre],
    fecha: o.hoy,
    vigenciaDias: 7,
    mostrarB: true,
  };
}

/** Los parámetros en la URL (para volver a abrir la misma propuesta) y de vuelta. */
export function propuestaAUrl(p: ParametrosPropuesta): string {
  const q = new URLSearchParams({
    cliente: p.cliente,
    unidad: p.unidad,
    precio: String(p.precioUsd),
    tc: String(p.tipoCambio),
    base: p.mesBaseCac,
    formal: String(p.formal),
    antA: String(p.anticipoAUsd),
    antB: String(p.anticipoBUsd),
    cuotas: `${p.cuotas.cantidad}@${p.cuotas.desde}`,
    refA: p.refuerzosA.map((r) => `${r.mes}:${r.porcentaje}`).join(","),
    refB: p.refuerzosB.join(","),
    fecha: p.fecha,
    vig: String(p.vigenciaDias),
    b: p.mostrarB ? "1" : "0",
  });
  return q.toString();
}

export function propuestaDeUrl(q: URLSearchParams, base: ParametrosPropuesta): ParametrosPropuesta {
  const n = (k: string, d: number) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
  const mes = (t: string | null | undefined) => (t && /^\d{4}-\d{2}$/.test(t) ? t : null);
  const [cant, desde] = (q.get("cuotas") ?? "").split("@");
  return {
    cliente: q.get("cliente") ?? base.cliente,
    unidad: q.get("unidad") ?? base.unidad,
    precioUsd: n("precio", base.precioUsd),
    tipoCambio: n("tc", base.tipoCambio),
    mesBaseCac: mes(q.get("base")) ?? base.mesBaseCac,
    formal: n("formal", base.formal),
    anticipoAUsd: n("antA", base.anticipoAUsd),
    anticipoBUsd: n("antB", base.anticipoBUsd),
    cuotas: { cantidad: Number(cant) || base.cuotas.cantidad, desde: mes(desde) ?? base.cuotas.desde },
    refuerzosA: q.has("refA")
      ? (q.get("refA") ?? "")
          .split(",")
          .filter(Boolean)
          .map((x) => ({ mes: mes(x.split(":")[0]) ?? "", porcentaje: Number(x.split(":")[1]) || 0 }))
      : base.refuerzosA,
    refuerzosB: q.has("refB") ? (q.get("refB") ?? "").split(",").filter((x) => mes(x)) : base.refuerzosB,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(q.get("fecha") ?? "") ? q.get("fecha")! : base.fecha,
    vigenciaDias: n("vig", base.vigenciaDias),
    mostrarB: q.has("b") ? q.get("b") === "1" : base.mostrarB,
  };
}

/** El nombre con que se guarda el PDF: "UF 2C - LERMA 439 - Virginia Alegre by Mindlin Developers". */
export function nombreDelPdf(p: Pick<ParametrosPropuesta, "unidad" | "cliente">, proyecto: string): string {
  // Sin caracteres que los sistemas no aceptan en un nombre de archivo.
  const limpio = (t: string) => t.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${[p.unidad ? `UF ${limpio(p.unidad)}` : "", limpio(proyecto).toUpperCase(), limpio(p.cliente)].filter(Boolean).join(" - ")} by Mindlin Developers`;
}

/** Un resumen en una línea, para el historial del CRM. */
export function resumenPropuesta(p: ParametrosPropuesta, r: Propuesta): string {
  const usd = (x: number) => `US$ ${Math.round(x).toLocaleString("es-AR")}`;
  const ars = (x: number) => `$ ${Math.round(x).toLocaleString("es-AR")}`;
  return `Propuesta ${p.unidad} por ${usd(p.precioUsd)} (${ars(r.totalArs)} a $ ${p.tipoCambio}). A ${Math.round(p.formal * 100)}%: anticipo ${usd(p.anticipoAUsd)}, ${p.cuotas.cantidad} cuotas de ${ars(r.A.cuotaArs)} desde ${nombreMes(p.cuotas.desde).toLowerCase()}${r.A.refuerzos.length ? `, refuerzos ${r.A.refuerzos.map((x) => `${nombreMes(x.mes, true)} ${ars(x.ars)}`).join(" y ")}` : ""}. B ${Math.round((1 - p.formal) * 100)}%: anticipo ${usd(p.anticipoBUsd)}${r.B.refuerzos.length ? `, refuerzo ${r.B.refuerzos.map((x) => `${nombreMes(x.mes, true)} ${ars(x.ars)}`).join(" y ")}` : ""}. Vale hasta el ${r.hasta.split("-").reverse().join("/")}.`;
}
