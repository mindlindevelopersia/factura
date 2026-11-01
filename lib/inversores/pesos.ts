/**
 * La cuenta de un inversor en pesos ajustados por CAC a hoy. En Lerma casi todos pagan en pesos y
 * las cuotas se ajustan por CAC: comparar pesos nominales de distintos meses no sirve. Acá todo se
 * lleva a pesos del último CAC publicado, con la misma regla que las cuotas (el índice de un mes es
 * el del mes anterior):
 *
 * - Costo en pesos hoy = costo en pesos del contrato × CAC(último) ÷ CAC(mes anterior al mes base).
 * - Pago en pesos hoy = monto × CAC(último) ÷ CAC(mes anterior al del pago).
 * - Pago en dólares: a pesos con el tipo de cambio del contrato (costo en pesos ÷ costo en dólares),
 *   que son pesos del mes base, y de ahí igual que el costo. Así un dólar pagado vale lo mismo que
 *   un dólar del precio.
 * - Avance = pagado hoy ÷ costo hoy.
 *
 * Todo lo de acá es puro (sin red).
 */

import { sumarMeses } from "../finanzas/ingresos";
import type { SerieCac } from "../indicadores/cac";
import type { Cuenta } from "./cuentas";

/** Lo que hace falta del CAC: el índice general por mes y el último publicado. */
export interface IndicesCac {
  ultimo: string | null;
  general: Record<string, number>;
}

export function indicesCac(serie: SerieCac): IndicesCac {
  const general: Record<string, number> = {};
  for (const m of serie.meses) if (m.general.indice != null) general[m.mes] = m.general.indice;
  return { ultimo: serie.ultimo, general };
}

export interface PagoEnPesos {
  /** En pesos del día del pago (los dólares, al tipo de cambio del contrato). */
  pesos: number;
  factor: number | null;
  /** En pesos de hoy. Null si falta algún índice o la fecha. */
  hoy: number | null;
}

export interface AvanceEnPesos {
  /** El CAC al que se lleva todo (el último publicado, o el del mes anterior a hoy). */
  mesCac: string;
  tipoCambioContrato: number | null;
  costoContrato: number | null;
  costoHoy: number | null;
  pagadoHoy: number;
  saldoHoy: number | null;
  avance: number | null;
  /** Por fila de la planilla. */
  pagos: Record<number, PagoEnPesos>;
  /** Pagos que no se pudieron llevar a hoy (sin fecha o sin índice): no suman. */
  sinAjustar: number;
  /** Por qué no se puede calcular el costo de hoy, si no se puede. */
  falta: string | null;
}

const mesDe = (fecha: string | null) => (fecha && /^\d{4}-\d{2}/.test(fecha) ? fecha.slice(0, 7) : null);

export function avanceEnPesos(
  c: Pick<Cuenta, "precioUsd" | "precioArs" | "formalUsd" | "mesBaseCac" | "pagos">,
  cac: IndicesCac | null,
  mesActual: string,
  informal = true,
): AvanceEnPesos | null {
  if (!cac?.ultimo) return null;
  const mesCac = sumarMeses(mesActual, -1) < cac.ultimo ? sumarMeses(mesActual, -1) : cac.ultimo;
  const final = cac.general[mesCac];
  if (final == null) return null;
  /** De pesos del mes `mes` a pesos de hoy. */
  const factorDesde = (mes: string | null) => {
    if (!mes) return null;
    const inicial = sumarMeses(mes, -1);
    if (inicial >= mesCac) return 1;
    const a = cac.general[inicial];
    return a ? final / a : null;
  };

  const tipoCambioContrato = c.precioArs && c.precioUsd ? c.precioArs / c.precioUsd : null;
  const baseUsd = informal ? c.precioUsd : c.formalUsd;
  const costoContrato = baseUsd != null && tipoCambioContrato ? baseUsd * tipoCambioContrato : null;
  const factorBase = factorDesde(c.mesBaseCac);
  const falta = !c.mesBaseCac ? "Falta el mes base CAC" : costoContrato == null ? "Falta el costo en pesos" : factorBase == null ? "Falta el CAC del mes base" : null;
  const costoHoy = costoContrato != null && factorBase != null ? costoContrato * factorBase : null;

  const pagos: Record<number, PagoEnPesos> = {};
  let pagadoHoy = 0;
  let sinAjustar = 0;
  for (const p of informal ? c.pagos : c.pagos.filter((x) => x.formal === true)) {
    let pesos: number;
    let factor: number | null;
    if (p.moneda === "USD") {
      const tc = tipoCambioContrato ?? p.tipoCambio;
      pesos = p.monto * (tc ?? 0);
      factor = tc == null ? null : tipoCambioContrato ? factorBase : factorDesde(mesDe(p.fecha));
    } else {
      pesos = p.monto;
      factor = factorDesde(mesDe(p.fecha));
    }
    const hoy = factor != null && pesos ? pesos * factor : null;
    pagos[p.fila] = { pesos, factor, hoy };
    if (hoy == null) sinAjustar++;
    else pagadoHoy += hoy;
  }
  return {
    mesCac,
    tipoCambioContrato,
    costoContrato,
    costoHoy,
    pagadoHoy,
    saldoHoy: costoHoy != null ? costoHoy - pagadoHoy : null,
    avance: costoHoy ? pagadoHoy / costoHoy : null,
    pagos,
    sinAjustar,
    falta,
  };
}
