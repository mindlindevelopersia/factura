/**
 * Cobranzas: qué tiene vencido cada inversor, cuánto es al día de hoy (actualizado por CAC), qué
 * vence este mes y el próximo, y el mensaje para avisarle.
 *
 * Reglas (acordadas el 31/10/2026, ver docs/inversores-cobranzas.md):
 * - La cuota (o el refuerzo) de un mes vence el día 10 de ese mes; la de Marcelo Martín, el 20.
 * - Cuotas: el Flujo ya las tiene ajustadas a su mes, con el índice del mes anterior. Si están
 *   vencidas, se llevan a hoy: monto × CAC(mes anterior a hoy) ÷ CAC(mes anterior a la cuota).
 * - Refuerzos: el Flujo los tiene a valores del "Mes Base CAC". Se ajustan desde ahí:
 *   monto × CAC(mes anterior al de pago, o a hoy si está vencido) ÷ CAC(mes anterior al base).
 * - El mensaje lleva solo lo formal y lo firma Tadeo.
 * - Antes de avisar: si hay pagos registrados después del vencimiento, o la celda está en
 *   amarillo, hay que verificar.
 *
 * Todo lo de acá es puro (sin red).
 */

import { nombreMes, sumarMeses, type Moneda, type Pago } from "../finanzas/ingresos";
import type { SerieCac } from "../indicadores/cac";
import type { CuentasCorrientes, Movimiento } from "./cuentas";

export const DIA_VENCIMIENTO = 10;
/** Cuentas que vencen otro día. */
export const VENCIMIENTOS_ESPECIALES: { inversor: RegExp; dia: number }[] = [{ inversor: /marcelo martin/i, dia: 20 }];
export const FIRMA = "Tadeo – Administración Mindlin Developers";

export function diaVencimiento(inversor: string): number {
  const n = inversor.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return VENCIMIENTOS_ESPECIALES.find((v) => v.inversor.test(n))?.dia ?? DIA_VENCIMIENTO;
}

export interface ItemCobranza {
  pago: Pago;
  /** "2026-09-10". */
  vence: string;
  /** Días desde el vencimiento (0 si todavía no venció). */
  diasVencido: number;
  vencido: boolean;
  formal: boolean;
  /** El monto a pagar: al día de hoy si está vencido, o a su mes si no. Null si no se pudo actualizar. */
  actualizado: number | null;
  factor: number | null;
  /** La cuenta del ajuste, para verificarla. */
  calculo: string;
}

export interface Cobranza {
  id: string;
  inversor: string;
  unidad: string;
  telefono: string;
  dia: number;
  vencidos: ItemCobranza[];
  esteMes: ItemCobranza[];
  proximoMes: ItemCobranza[];
  /** Total vencido actualizado por moneda (lo que no se pudo actualizar va por su monto). */
  totalVencido: Record<Moneda, number>;
  totalVencidoFormal: Record<Moneda, number>;
  /** Motivos para revisar antes de avisar. */
  verificar: string[];
  /** Pagos registrados en la cuenta desde el primer vencimiento (para el control). */
  pagosPosteriores: Movimiento[];
  /** "Pagos por Inversor" o solo el Flujo (sin pagos para controlar). */
  conCuenta: boolean;
  mensaje: string | null;
  whatsapp: string | null;
}

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const indiceTxt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Días entre dos fechas "aaaa-mm-dd". */
function dias(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

/** Hoy en Buenos Aires, "aaaa-mm-dd". */
export function hoyBuenosAires(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

/**
 * El monto de un pago pendiente al mes objetivo (hoy si está vencido, su mes si no), ajustado por CAC.
 * Solo los pesos se ajustan.
 */
export function ajustar(pago: Pago, mesObjetivo: string, cac: SerieCac | null, mesBaseCuenta: string | null): { monto: number | null; factor: number | null; calculo: string } {
  if (pago.moneda !== "ARS") return { monto: pago.monto, factor: 1, calculo: "En dólares: no se ajusta por CAC." };
  if (!cac || !cac.ultimo) return { monto: null, factor: null, calculo: "No se pudo leer el índice CAC." };
  const indice = (mes: string) => cac.meses.find((m) => m.mes === mes)?.general.indice ?? null;
  // El índice que corresponde a un mes es el del mes anterior (así se arman las cuotas en el Flujo).
  const mesFinal = sumarMeses(mesObjetivo, -1) > cac.ultimo ? cac.ultimo : sumarMeses(mesObjetivo, -1);
  const desde = pago.tipo === "refuerzo" ? (pago.mesBase ?? mesBaseCuenta) : pago.mes;
  if (!desde) return { monto: null, factor: null, calculo: "Refuerzo sin mes base CAC: no se puede actualizar." };
  const mesInicial = sumarMeses(desde, -1);
  if (mesInicial === mesFinal) return { monto: pago.monto, factor: 1, calculo: `Ya está a valores del último CAC publicado (${nombreMes(mesFinal, true)}).` };
  if (mesInicial > mesFinal) {
    return { monto: pago.monto, factor: 1, calculo: `Monto proyectado del Flujo: todavía no salió el CAC de ${nombreMes(mesInicial).toLowerCase()}.` };
  }
  const a = indice(mesInicial);
  const b = indice(mesFinal);
  if (a == null || b == null) return { monto: null, factor: null, calculo: `Falta el CAC de ${nombreMes(a == null ? mesInicial : mesFinal).toLowerCase()}.` };
  const factor = b / a;
  const monto = pago.monto * factor;
  return {
    monto,
    factor,
    calculo: `${pesos(pago.monto)} × CAC ${nombreMes(mesFinal, true)} (${indiceTxt(b)}) ÷ CAC ${nombreMes(mesInicial, true)} (${indiceTxt(a)}) = ${pesos(monto)}`,
  };
}

/** De qué es un pago de la cuenta, por su concepto. */
export function tipoDeConcepto(concepto: string): "cuota" | "refuerzo" | null {
  if (/cuota/i.test(concepto)) return "cuota";
  if (/refuerzo/i.test(concepto)) return "refuerzo";
  return null;
}

/** "Marcelo Martin & Valeria Masson" → "Marcelo y Valeria". */
export function saludo(inversor: string): string {
  const nombres = inversor
    .split(/\s*(?:&|\/|\sy\s)\s*/i)
    .map((p) => p.trim().split(/\s+/)[0])
    .filter(Boolean);
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : (nombres[0] ?? "");
}

/** El teléfono en formato internacional para WhatsApp (solo dígitos), o null si no sirve. */
export function telefonoWhatsapp(telefono: string): string | null {
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) d = `549${d}`; // Celular argentino sin código de país.
  else if (d.length === 11 && d.startsWith("9")) d = `54${d}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

function detalleItem(i: ItemCobranza): string {
  const monto = i.actualizado ?? i.pago.monto;
  return `• ${i.pago.detalle} de ${nombreMes(i.pago.mes!).toLowerCase()}: ${i.pago.moneda === "USD" ? `US$ ${monto.toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : pesos(monto)}`;
}

/** El mensaje para el inversor, solo con lo formal. Null si no hay nada formal para avisar. */
export function mensajeCobranza(c: Pick<Cobranza, "inversor" | "unidad" | "vencidos" | "esteMes" | "dia">): string | null {
  const vencidos = c.vencidos.filter((i) => i.formal);
  const proximos = c.esteMes.filter((i) => i.formal);
  const hola = `Hola ${saludo(c.inversor)}, ¿cómo estás? Te escribimos de Mindlin Developers por tu unidad ${c.unidad} de Lerma 439.`;
  const cierre = `\nSaludos,\n${FIRMA}`;
  if (vencidos.length) {
    const total = (m: Moneda) => vencidos.filter((i) => i.pago.moneda === m).reduce((s, i) => s + (i.actualizado ?? i.pago.monto), 0);
    const totales = [total("ARS") ? pesos(total("ARS")) : null, total("USD") ? `US$ ${total("USD").toLocaleString("es-AR")}` : null].filter(Boolean).join(" + ");
    return [
      hola,
      `Según nuestros registros ${vencidos.length === 1 ? "tenés pendiente" : "tenés pendientes"}:`,
      ...vencidos.map(detalleItem),
      vencidos.length > 1 ? `Total actualizado por CAC al día de hoy: ${totales}.` : "Monto actualizado por CAC al día de hoy.",
      "Si ya lo abonaste, avisanos así lo actualizamos. ¡Gracias!",
      cierre,
    ].join("\n");
  }
  if (proximos.length) {
    return [
      hola,
      `Te recordamos que el ${c.dia} de ${nombreMes(proximos[0].pago.mes!).toLowerCase().replace(/ \d{4}$/, "")} vence:`,
      ...proximos.map(detalleItem),
      "¡Gracias!",
      cierre,
    ].join("\n");
  }
  return null;
}

/** Arma la cobranza de cada cuenta con algo vencido o por vencer este mes o el próximo. */
export function armarCobranzas(cc: CuentasCorrientes, cac: SerieCac | null, hoy: string): Cobranza[] {
  const mesHoy = hoy.slice(0, 7);
  const mesProximo = sumarMeses(mesHoy, 1);
  const r: Cobranza[] = [];

  for (const c of cc.cuentas) {
    const dia = diaVencimiento(c.inversor);
    const items = c.pendientes
      .filter((p) => p.mes && p.mes <= mesProximo)
      .map((pago): ItemCobranza => {
        const vence = `${pago.mes}-${String(dia).padStart(2, "0")}`;
        const vencido = hoy > vence;
        const a = ajustar(pago, vencido ? mesHoy : pago.mes!, cac, c.mesBaseCac);
        return { pago, vence, vencido, diasVencido: vencido ? dias(vence, hoy) : 0, formal: pago.bn === "blanco", actualizado: a.monto, factor: a.factor, calculo: a.calculo };
      });
    const vencidos = items.filter((i) => i.vencido);
    const esteMes = items.filter((i) => !i.vencido && i.pago.mes === mesHoy);
    const proximoMes = items.filter((i) => !i.vencido && i.pago.mes === mesProximo);
    if (!vencidos.length && !esteMes.length && !proximoMes.length) continue;

    const total = (lista: ItemCobranza[], m: Moneda) => lista.filter((i) => i.pago.moneda === m).reduce((s, i) => s + (i.actualizado ?? i.pago.monto), 0);
    const verificar: string[] = [];
    let pagosPosteriores: Movimiento[] = [];
    if (vencidos.length && c.origen === "planilla") {
      // Por tipo (cuota o refuerzo) y formal/informal: si desde el primer vencido hay más pagos
      // registrados que meses cobrados (en verde) en el Flujo, algún vencido puede estar pago.
      for (const tipo of ["cuota", "refuerzo"] as const) {
        for (const formal of [true, false]) {
          const mios = vencidos.filter((i) => i.pago.tipo === tipo && i.formal === formal);
          if (!mios.length) continue;
          const desde = mios[0].pago.mes!;
          const pagos = c.pagos.filter((p) => p.fecha && p.fecha >= `${desde}-01` && p.formal === formal && tipoDeConcepto(p.concepto) === tipo);
          const cobrados = c.cobradoFlujo.filter((p) => p.tipo === tipo && (p.bn === "blanco") === formal && p.mes && p.mes >= desde);
          if (pagos.length > cobrados.length) {
            pagosPosteriores.push(...pagos);
            verificar.push(
              `${tipo === "cuota" ? "Cuotas" : "Refuerzos"} ${formal ? "formales" : "informales"}: hay ${pagos.length} ${pagos.length === 1 ? "pago registrado" : "pagos registrados"} en "Pagos por Inversor" desde ${nombreMes(desde).toLowerCase()} y ${cobrados.length} ${cobrados.length === 1 ? "mes cobrado" : "meses cobrados"} en el Flujo. Puede que ya haya pagado y falte pintar de verde.`,
            );
          }
        }
      }
      pagosPosteriores = [...new Set(pagosPosteriores)].sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
    }
    if (items.some((i) => i.pago.color === "amarillo")) verificar.push("Hay montos marcados en amarillo en el Flujo: actualizarlos antes de avisar.");
    if (items.some((i) => i.actualizado == null)) verificar.push("Hay montos que no se pudieron actualizar por CAC.");

    const base = { inversor: c.inversor, unidad: c.unidad, vencidos, esteMes, dia };
    const mensaje = mensajeCobranza(base);
    const tel = telefonoWhatsapp(c.telefono);
    r.push({
      id: c.id,
      inversor: c.inversor,
      unidad: c.unidad,
      telefono: c.telefono,
      dia,
      vencidos,
      esteMes,
      proximoMes,
      totalVencido: { ARS: total(vencidos, "ARS"), USD: total(vencidos, "USD") },
      totalVencidoFormal: { ARS: total(vencidos.filter((i) => i.formal), "ARS"), USD: total(vencidos.filter((i) => i.formal), "USD") },
      verificar,
      pagosPosteriores,
      conCuenta: c.origen === "planilla",
      mensaje,
      whatsapp: mensaje && tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}` : null,
    });
  }

  // Primero lo que lleva más tiempo vencido.
  return r.sort((a, b) => (b.vencidos[0]?.diasVencido ?? -1) - (a.vencidos[0]?.diasVencido ?? -1) || a.unidad.localeCompare(b.unidad, "es", { numeric: true }));
}

export function totalesCobranzas(cobranzas: Cobranza[], hoy: string) {
  const mesHoy = hoy.slice(0, 7);
  const suma = (f: (c: Cobranza) => number) => cobranzas.reduce((s, c) => s + f(c), 0);
  const items = (c: Cobranza, lista: "esteMes" | "proximoMes", m: Moneda) => c[lista].filter((i) => i.pago.moneda === m).reduce((s, i) => s + (i.actualizado ?? i.pago.monto), 0);
  return {
    mes: mesHoy,
    vencido: { ARS: suma((c) => c.totalVencido.ARS), USD: suma((c) => c.totalVencido.USD) },
    cuentasConVencidos: cobranzas.filter((c) => c.vencidos.length).length,
    esteMes: { ARS: suma((c) => items(c, "esteMes", "ARS")), USD: suma((c) => items(c, "esteMes", "USD")) },
    proximoMes: { ARS: suma((c) => items(c, "proximoMes", "ARS")), USD: suma((c) => items(c, "proximoMes", "USD")) },
    paraVerificar: cobranzas.filter((c) => c.verificar.length).length,
  };
}
