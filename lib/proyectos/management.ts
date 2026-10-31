/**
 * Management de un proyecto: los m² que se quedan los desarrolladores, a qué valor y cómo se
 * reparten entre los socios. Lo de los desarrolladores no es ingreso del edificio: va aparte.
 *
 * Regla de Lerma (31/10/2026, a confirmar): la parte de los desarrolladores (15%) de los m² de
 * venta sin amenities, más esa parte de los amenities sin contar los amenities que les tocarían a
 * ellos mismos (que no pagan): 15% × m² de venta + 15% × 85% × m² de amenities.
 *
 * Todo lo de acá es puro (sin red). Ver docs/proyectos-comercial.md.
 */

import type { Celda } from "../finanzas/ingresos";
import type { Socio } from "../modulos";
import type { Supuesto, Unidad } from "./comercial";

export interface Desarrolladores {
  parte: number;
  m2Venta: number;
  m2Amenities: number;
  m2: { propios: number; amenities: number; total: number };
  /** Lo mismo con la superficie propia completa (sin el ajuste de terrazas), para comparar. */
  m2ConPropiaCompleta: number;
  /** Lo que figura en EE.RR como "M2 canjeados a Developers", si está. */
  m2EnPlanilla: number | null;
  m2Libres: number;
  socios: (Socio & { m2: number })[];
  supuestos: Supuesto[];
}

export interface GastoHq {
  ARS: number;
  USD: number;
  movimientos: number;
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
  const m2Propia = deptos.reduce((s, u) => s + u.supPropia, 0);
  const m2Amenities = deptos.reduce((s, u) => s + u.supAmenities, 0);
  const propios = parte * m2Venta;
  const amenities = parte * (1 - parte) * m2Amenities;
  const total = propios + amenities;
  const m2Libres = deptos.filter((u) => u.estado === "libre").reduce((s, u) => s + u.supTotal, 0);
  const pct = `${Math.round(parte * 100)}%`;
  const supuestos: Supuesto[] = [
    {
      tipo: "por-confirmar",
      titulo: `Cómo se calculan los m² de los desarrolladores`,
      detalle: `${pct} de los m² de venta sin amenities (${m2(m2Venta)}) + ${pct} del ${Math.round((1 - parte) * 100)}% de los amenities (${m2(m2Amenities)}), porque los amenities que les tocan a los desarrolladores no se cuentan: ${m2(propios)} + ${m2(amenities)} = ${m2(total)}.`,
      mientras: `Si se usara la superficie propia completa (${m2(m2Propia)}, sin el ajuste de terrazas), daría ${m2(parte * m2Propia + amenities)}.`,
      origen: 'Excel madre → "Lista de precios": suma de "Sup Propia VENTA" y de "Superficie Amenities" de las 28 unidades.',
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
    const ars = hq.ARS ? `$ ${Math.round(hq.ARS).toLocaleString("es-AR")}` : null;
    const usd = hq.USD ? `US$ ${Math.round(hq.USD).toLocaleString("es-AR")}` : null;
    supuestos.push({
      tipo: "conflicto",
      titulo: "Gastos de HQ pagados con plata del proyecto",
      detalle: `En la caja del proyecto hay ${hq.movimientos} egresos marcados como HQ (${[ars, usd].filter(Boolean).join(" y ")}). Son de Mindlin Developers, no del edificio: hay que separarlos y devolvérselos al proyecto.`,
      mientras: "Por ahora quedan dentro del proyecto, como en la planilla.",
      origen: 'Pestañas de caja → columna "Corresponde" = HQ (ver Finanzas → Egresos, filtro Proyecto).',
    });
  }
  return {
    parte,
    m2Venta,
    m2Amenities,
    m2: { propios, amenities, total },
    m2ConPropiaCompleta: parte * m2Propia + amenities,
    m2EnPlanilla,
    m2Libres,
    socios: socios.map((s) => ({ ...s, m2: total * s.parte })),
    supuestos,
  };
}
