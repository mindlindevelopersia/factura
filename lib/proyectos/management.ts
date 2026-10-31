/**
 * Management de un proyecto: los m² que se quedan los desarrolladores, a qué valor y cómo se
 * reparten entre los socios. Lo de los desarrolladores no es ingreso del edificio: va aparte.
 *
 * Regla (confirmada el 31/10/2026): la parte de los desarrolladores (15% en Lerma) de los m²
 * vendibles sin amenities ("Sup Propia VENTA" de la lista de precios). Los amenities no se cuentan.
 *
 * Todo lo de acá es puro (sin red). Ver docs/proyectos-comercial.md.
 */

import type { Celda } from "../finanzas/ingresos";
import type { Socio } from "../modulos";
import type { Supuesto, Unidad } from "./comercial";

export interface Desarrolladores {
  parte: number;
  m2Venta: number;
  /** Los amenities del proyecto: no se cuentan, se muestran para que se vea qué quedó afuera. */
  m2Amenities: number;
  /** Los m² de los desarrolladores: parte × m² de venta. */
  m2: number;
  /** Lo que figura en EE.RR como "M2 canjeados a Developers", si está. */
  m2EnPlanilla: number | null;
  m2Libres: number;
  socios: (Socio & { m2: number })[];
  supuestos: Supuesto[];
}

export interface MontoHq {
  movimientos: number;
  ARS: number;
  USD: number;
}

export interface EgresoHq {
  fecha: string | null;
  descripcion: string;
  rubro: string;
  moneda: "ARS" | "USD";
  monto: number;
  pestania: string;
  fila: number;
}

export interface GastoHq extends MontoHq {
  /** Impuestos al débito y crédito, IIBB, comisiones: los cobra el banco por mover la plata. */
  bancarios: MontoHq;
  /** Lo que parece de obra (materiales, hormigón, constructora) o es grande en dólares. */
  sospechosos: EgresoHq[];
}

/** Rubros que son de la obra, no de la oficina: si están marcados como HQ, probablemente sea un error. */
const RUBROS_DE_OBRA = new Set(["terreno", "constructora", "hormigon", "hierro", "derechos", "electricidad", "materiales"]);

/** Separa los egresos marcados como HQ: cuánto es del banco, qué parece de obra y el total. */
export function analizarHq(egresos: (EgresoHq & { proyecto: string })[]): GastoHq {
  const deHq = egresos.filter((e) => /^hq$/i.test(e.proyecto.trim()));
  const sumar = (xs: EgresoHq[]): MontoHq => ({
    movimientos: xs.length,
    ARS: xs.filter((e) => e.moneda === "ARS").reduce((s, e) => s + e.monto, 0),
    USD: xs.filter((e) => e.moneda === "USD").reduce((s, e) => s + e.monto, 0),
  });
  return {
    ...sumar(deHq),
    bancarios: sumar(deHq.filter((e) => e.rubro === "impuestos" || e.rubro === "bancarios")),
    sospechosos: deHq
      .filter((e) => RUBROS_DE_OBRA.has(e.rubro) || (e.moneda === "USD" && e.monto >= 5000))
      .map(({ fecha, descripcion, rubro, moneda, monto, pestania, fila }) => ({ fecha, descripcion, rubro, moneda, monto, pestania, fila })),
  };
}

/** "M2 canjeados a Developers" en la pestaña EE.RR del Excel madre. */
export function m2DesarrolladoresEnPlanilla(eerr: Celda[][]): number | null {
  for (const f of eerr) {
    const i = f.findIndex((c) => /m2 canjeados a develop/i.test(String(c.valor ?? "")));
    if (i >= 0) {
      const v = f.slice(i + 1).find((c) => typeof c.valor === "number")?.valor;
      return typeof v === "number" ? v : null;
    }
  }
  return null;
}

const m2 = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })} m²`;

export function desarrolladores(unidades: Unidad[], parte: number, socios: Socio[], m2EnPlanilla: number | null, hq: GastoHq | null): Desarrolladores {
  const deptos = unidades.filter((u) => !u.esCochera);
  const m2Venta = deptos.reduce((s, u) => s + u.supVenta, 0);
  const m2Amenities = deptos.reduce((s, u) => s + u.supAmenities, 0);
  // Los amenities no se cuentan (confirmado el 31/10/2026): más simple y más real.
  const total = parte * m2Venta;
  const m2Libres = deptos.filter((u) => u.estado === "libre").reduce((s, u) => s + u.supTotal, 0);
  const pct = `${Math.round(parte * 100)}%`;
  const supuestos: Supuesto[] = [
    {
      tipo: "confirmado",
      titulo: `Los desarrolladores se quedan el ${pct} de los m² vendibles, sin amenities`,
      detalle: `${pct} de ${m2(m2Venta)} de venta = ${m2(total)}. Los amenities (${m2(m2Amenities)}) no se cuentan.`,
      origen: 'Excel madre → "Lista de precios": suma de "Sup Propia VENTA" de las 28 unidades. Confirmado el 31/10/2026.',
    },
  ];
  if (m2EnPlanilla != null && Math.abs(m2EnPlanilla - total) > 1) {
    supuestos.push({
      tipo: "conflicto",
      titulo: "La planilla dice otra cosa",
      detalle: `En EE.RR, "M2 canjeados a Developers" dice ${m2(m2EnPlanilla)}. Con la regla de arriba da ${m2(total)}. ¿Cuál vale?`,
      origen: 'Excel madre → "EE.RR" → "M2 canjeados a Developers".',
    });
  }
  supuestos.push({
    tipo: "por-confirmar",
    titulo: "Lo que falta vender y los m² de los desarrolladores",
    detalle: `Quedan ${m2(m2Libres)} sin vender y a los desarrolladores les corresponden ${m2(total)}. Si esos m² salen del stock sin vender, para terceros quedan ${m2(Math.max(0, m2Libres - total))}.`,
    mientras: "El tablero muestra lo que falta vender completo, a precio de lista, sin descontar lo de los desarrolladores.",
  });
  if (hq && hq.movimientos > 0) {
    const plata = (x: MontoHq) => [x.ARS ? `$ ${Math.round(x.ARS).toLocaleString("es-AR")}` : null, x.USD ? `US$ ${Math.round(x.USD).toLocaleString("es-AR")}` : null].filter(Boolean).join(" y ");
    const resto = hq.movimientos - hq.bancarios.movimientos - hq.sospechosos.length;
    const sospechosos = hq.sospechosos
      .map((e) => `"${e.descripcion || e.rubro}" ${e.moneda === "USD" ? "US$" : "$"} ${Math.round(e.monto).toLocaleString("es-AR")} (${e.pestania}, fila ${e.fila})`)
      .join("; ");
    supuestos.push({
      tipo: "conflicto",
      titulo: `Para chequear: ${hq.movimientos} egresos marcados como HQ`,
      detalle: `En la caja del proyecto hay ${hq.movimientos} egresos marcados como HQ (${plata(hq)}). Parecen demasiados. ${hq.bancarios.movimientos} son impuestos y gastos del banco (débitos y créditos, IIBB, comisiones: ${plata(hq.bancarios)}), que el banco cobra por mover la plata del proyecto: ¿no son de Lerma?${
        sospechosos ? ` ${hq.sospechosos.length} parecen de la obra y no de HQ: ${sospechosos}.` : ""
      } Quedan ${resto} de oficina (honorarios, sueldos, servicios…).`,
      mientras: "Por ahora quedan dentro del proyecto, como en la planilla. Cuando se separen, se devuelven a Lerma.",
      origen: 'Pestañas de caja → columna "Corresponde" = HQ (ver Finanzas → Egresos, filtro Proyecto).',
    });
  }
  return {
    parte,
    m2Venta,
    m2Amenities,
    m2: total,
    m2EnPlanilla,
    m2Libres,
    socios: socios.map((s) => ({ ...s, m2: total * s.parte })),
    supuestos,
  };
}
