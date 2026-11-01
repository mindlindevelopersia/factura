/**
 * La plusvalía (Ley 6062, "Derechos para el desarrollo urbano y el hábitat sustentable") de una
 * prefactibilidad, paso a paso y con la cuenta de cada paso a la vista:
 *
 *   A1 = superficie que computa el Gobierno × ajuste (0,8)
 *   A2 = superficie de la parcela × FOT del distrito
 *   A  = A1 − A2 (m²)
 *   B  = incidencia del suelo (UVA/m², Ciudad 3D) × alícuota de la zona
 *   Base imponible = A × B (en UVA)
 *   Plusvalía = base × valor del UVA ($), y con el descuento por pago de contado.
 *
 * Con un pago registrado, se verifica: del monto pagado sale el UVA que se usó, y se compara con
 * el oficial de ese día. Todo puro (sin red).
 */

import type { Calculo, DatosPrefactibilidad } from "./modelo";

export interface DatosPlusvalia {
  /** La superficie que computa el Gobierno (la del plano o el permiso). null: la construible según GCBA. */
  superficieComputable: number | null;
  /** El ajuste del Gobierno sobre esa superficie (0,8). */
  ajuste: number;
  /** null: la superficie del terreno. */
  superficieParcela: number | null;
  /** null: el FOT de la normativa. */
  fot: number | null;
  /** Valor de incidencia del suelo, en UVA por m² (Ciudad 3D). */
  incidencia: number | null;
  /** Alícuota de la zona (0,27 = 27%). */
  alicuota: number | null;
  zona: string;
  /** Descuento por pagar de contado (0,15 = 15%). */
  descuentoContado: number;
  /** El pago registrado, para verificar la cuenta. */
  pago: { fecha: string; monto: number } | null;
}

export const PLUSVALIA_VACIA: DatosPlusvalia = { superficieComputable: null, ajuste: 0.8, superficieParcela: null, fot: null, incidencia: null, alicuota: null, zona: "", descuentoContado: 0.15, pago: null };

const num = (v: unknown, def: number | null = null): number | null => {
  if (v === null || v === undefined || v === "") return def;
  const x = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(x) && x >= 0 ? x : def;
};

export function limpiarPlusvalia(x: unknown): DatosPlusvalia {
  const o = (x ?? {}) as Record<string, unknown>;
  const pago = (o.pago ?? null) as { fecha?: unknown; monto?: unknown } | null;
  const fechaPago = typeof pago?.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(pago.fecha) ? pago.fecha : null;
  const montoPago = num(pago?.monto);
  return {
    superficieComputable: num(o.superficieComputable),
    ajuste: Math.min(1, num(o.ajuste, 0.8)!),
    superficieParcela: num(o.superficieParcela),
    fot: num(o.fot),
    incidencia: num(o.incidencia),
    alicuota: num(o.alicuota) != null ? Math.min(1, num(o.alicuota)!) : null,
    zona: typeof o.zona === "string" ? o.zona.slice(0, 60) : "",
    descuentoContado: Math.min(1, num(o.descuentoContado, 0.15)!),
    pago: fechaPago && montoPago ? { fecha: fechaPago, monto: montoPago } : null,
  };
}

export type Unidad = "m²" | "UVA/m²" | "UVA" | "$" | "US$" | "%" | "";

export interface Paso {
  clave: string;
  nombre: string;
  valor: number | null;
  unidad: Unidad;
  /** La cuenta con los números ("1.538 × 0,8 = 1.230,4"), o de dónde sale el dato. */
  cuenta: string;
  /** Un paso principal (se resalta). */
  total?: boolean;
}

export interface Plusvalia {
  pasos: Paso[];
  /** En pesos, sin descuento. */
  total: number | null;
  conDescuento: number | null;
  enDolares: number | null;
  avisos: string[];
  verificacion: {
    totalImplicito: number;
    uvaImplicito: number | null;
    uvaOficial: number | null;
    /** (implícito − oficial) / oficial. */
    diferencia: number | null;
  } | null;
}

export const formatear = (x: number | null | undefined, unidad: Unidad = "", decimales = 2): string => {
  if (x == null) return "—";
  const n = x.toLocaleString("es-AR", { maximumFractionDigits: unidad === "%" ? 1 : decimales });
  if (unidad === "%") return `${(x * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
  if (unidad === "$") return `$ ${Math.round(x).toLocaleString("es-AR")}`;
  if (unidad === "US$") return `US$ ${Math.round(x).toLocaleString("es-AR")}`;
  return unidad ? `${n} ${unidad}` : n;
};
const f = (x: number, d = 2) => x.toLocaleString("es-AR", { maximumFractionDigits: d });
const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * La plusvalía con la cuenta de cada paso. `uva`: el valor del UVA a usar (y su fecha y de dónde
 * sale); `mep`: el dólar MEP de hoy (para verla en dólares); `uvaDelPago`: el UVA oficial del día del pago.
 */
export function calcularPlusvalia(
  d: DatosPrefactibilidad,
  c: Calculo,
  o: { uva: { valor: number; fecha: string; fuente: string } | null; mep: number | null; uvaDelPago?: number | null },
): Plusvalia {
  const p = d.plusvalia;
  const avisos: string[] = [];
  const sup = p.superficieComputable ?? c.construible.gcba;
  const parcela = p.superficieParcela ?? c.superficieTerreno;
  const fot = p.fot ?? d.normativa.fot;
  const a1 = r2(sup * p.ajuste);
  const a2 = fot != null ? r2(parcela * fot) : null;
  const aBruto = a2 != null ? r2(a1 - a2) : null;
  const a = aBruto != null ? Math.max(0, aBruto) : null;
  if (aBruto != null && aBruto <= 0) avisos.push("A1 no supera lo que permite el FOT (A2): no corresponde plusvalía.");
  if (fot == null) avisos.push("Falta el FOT del distrito.");
  if (p.incidencia == null || p.alicuota == null) avisos.push("Falta la incidencia del suelo o la alícuota de la zona (se sacan de Ciudad 3D).");
  const b = p.incidencia != null && p.alicuota != null ? r2(p.incidencia * p.alicuota) : null;
  const base = a != null && b != null ? r2(a * b) : null;
  const total = base != null && o.uva ? r2(base * o.uva.valor) : null;
  if (!o.uva) avisos.push("No hay valor del UVA: no se puede pasar a pesos.");
  const conDescuento = total != null ? r2(total * (1 - p.descuentoContado)) : null;
  const enDolares = conDescuento != null && o.mep ? r2(conDescuento / o.mep) : null;

  const pasos: Paso[] = [
    {
      clave: "superficie",
      nombre: "Superficie que computa el Gobierno",
      valor: sup,
      unidad: "m²",
      cuenta: p.superficieComputable != null ? "Cargada a mano (la del plano o el permiso)." : `La construible según GCBA de Superficies (cubierta + semicubierta de los pisos que computan): ${f(c.construible.gcba)} m². Si el Gobierno computa otra, cargala a mano.`,
    },
    { clave: "ajuste", nombre: "Ajuste del Gobierno", valor: p.ajuste, unidad: "%", cuenta: "Dato del Gobierno de la Ciudad (80%)." },
    { clave: "a1", nombre: "A1 = capacidad constructiva ajustada", valor: a1, unidad: "m²", cuenta: `${f(sup)} × ${f(p.ajuste)} = ${f(a1)}` },
    { clave: "parcela", nombre: "Superficie de la parcela", valor: parcela, unidad: "m²", cuenta: p.superficieParcela != null ? "Cargada a mano." : `La del terreno (frente × fondo): ${f(c.superficieTerreno)} m².` },
    { clave: "fot", nombre: "FOT del distrito", valor: fot, unidad: "", cuenta: p.fot != null ? "Cargado a mano." : "El de Lote y normativa." },
    { clave: "a2", nombre: "A2 = lo que permite el FOT", valor: a2, unidad: "m²", cuenta: a2 != null ? `${f(parcela)} × ${f(fot!)} = ${f(a2)}` : "Falta el FOT." },
    { clave: "a", nombre: "A = A1 − A2", valor: a, unidad: "m²", cuenta: aBruto != null ? `${f(a1)} − ${f(a2!)} = ${f(aBruto)}${aBruto < 0 ? " (negativo: 0)" : ""}` : "—", total: true },
    { clave: "incidencia", nombre: "Incidencia del suelo", valor: p.incidencia, unidad: "UVA/m²", cuenta: "De Ciudad 3D (Ley 6062)." },
    { clave: "alicuota", nombre: `Alícuota${p.zona ? ` (${p.zona})` : ""}`, valor: p.alicuota, unidad: "%", cuenta: "De Ciudad 3D, según la zona (Ley 6062)." },
    { clave: "b", nombre: "B = incidencia × alícuota", valor: b, unidad: "UVA/m²", cuenta: b != null ? `${f(p.incidencia!)} × ${f(p.alicuota!)} = ${f(b)}` : "—" },
    { clave: "base", nombre: "Base imponible = A × B", valor: base, unidad: "UVA", cuenta: base != null ? `${f(a!)} × ${f(b!)} = ${f(base)}` : "—", total: true },
    { clave: "uva", nombre: `Valor del UVA${o.uva ? ` (${o.uva.fecha.split("-").reverse().join("/")})` : ""}`, valor: o.uva?.valor ?? null, unidad: "$", cuenta: o.uva ? `${o.uva.fuente}.` : "Sin dato." },
    { clave: "total", nombre: "Plusvalía = base × UVA", valor: total, unidad: "$", cuenta: total != null ? `${f(base!)} × ${f(o.uva!.valor)} = $ ${f(total, 0)}` : "—", total: true },
    { clave: "contado", nombre: `De contado (−${f(p.descuentoContado * 100, 1)}%)`, valor: conDescuento, unidad: "$", cuenta: conDescuento != null ? `$ ${f(total!, 0)} × (1 − ${f(p.descuentoContado)}) = $ ${f(conDescuento, 0)}` : "—" },
    { clave: "dolares", nombre: "En dólares (MEP de hoy)", valor: enDolares, unidad: "US$", cuenta: enDolares != null ? `$ ${f(conDescuento!, 0)} ÷ ${f(o.mep!)} = US$ ${f(enDolares, 0)}` : "Sin el MEP de hoy." },
  ];

  let verificacion: Plusvalia["verificacion"] = null;
  if (p.pago) {
    const totalImplicito = r2(p.pago.monto / (1 - p.descuentoContado));
    const uvaImplicito = base ? r2(totalImplicito / base) : null;
    const oficial = o.uvaDelPago ?? null;
    verificacion = { totalImplicito, uvaImplicito, uvaOficial: oficial, diferencia: uvaImplicito != null && oficial ? Math.round(((uvaImplicito - oficial) / oficial) * 10000) / 10000 : null };
  }
  return { pasos, total, conDescuento, enDolares, avisos, verificacion };
}

/** El UVA de un día: el último publicado hasta esa fecha. */
export function uvaDelDia(serie: { fecha: string; valor: number }[], fecha: string): { fecha: string; valor: number } | null {
  let r: { fecha: string; valor: number } | null = null;
  for (const x of serie) {
    if (x.fecha > fecha) break;
    r = x;
  }
  return r;
}

/**
 * Lee de la pestaña "EE.RR" del Excel madre los datos de la plusvalía: la superficie (banda
 * edificable), la parcela, el ajuste, el FOT, la incidencia y la alícuota con su zona.
 */
export function plusvaliaDeEERR(filas: { valor: number | string | null }[][]): Partial<DatosPlusvalia> {
  const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const numero = (v: unknown) => {
    const x = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(x) && x > 0 ? x : null;
  };
  // El último número de la fila (en EE.RR los valores están a la derecha del rótulo).
  const valor = (re: RegExp) => {
    const f = filas.find((x) => re.test(norm(x[1]?.valor)));
    if (!f) return null;
    for (let i = f.length - 1; i >= 2; i--) {
      const n = numero(f[i]?.valor);
      if (n != null) return n;
    }
    return null;
  };
  const filaAlicuota = filas.find((x) => /^alicuota/.test(norm(x[1]?.valor)));
  return {
    superficieComputable: valor(/^superficie banda edificable/),
    superficieParcela: valor(/^superficie de parcela/),
    ajuste: valor(/^ajuste$/) ?? 0.8,
    fot: valor(/^fot$/),
    incidencia: valor(/^valor de incidencia/),
    alicuota: valor(/^alicuota/),
    zona: filaAlicuota ? String(filaAlicuota.find((c, i) => i >= 2 && typeof c?.valor === "string" && /zona/i.test(c.valor))?.valor ?? "") : "",
  };
}
