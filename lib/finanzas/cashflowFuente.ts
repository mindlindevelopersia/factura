import "server-only";
import { hoyBuenosAires } from "../inversores/cobranzas";
import { proyecto as buscarProyecto, PROYECTO_PRINCIPAL } from "../modulos";
import { actualizado, cashFlowReal, leerCashFlowMadre, mepDeSerie, proyectadoEnPesos, rangoDeMeses, type Cobro, type Partida } from "./cashflow";
import { nombreRubro } from "./egresos";
import { cajaEgresos, cuentasCorrientes, dolarHoy, grillaCashFlow, historicoMep } from "./fuente";

export interface RespuestaCashFlow {
  meses: string[];
  /** Desde qué mes el "actualizado" usa lo proyectado (el mes de hoy). */
  mesActual: string;
  proyectado: Partida[];
  real: Partida[];
  actualizado: Partida[];
  mepHoy: number | null;
  avisos: string[];
  leido: string;
}

/** El cash flow del proyecto: proyectado (Excel madre), real (cobros y cajas) y actualizado. */
export async function cashFlowProyecto(id: string, opciones?: { fresco?: boolean }): Promise<RespuestaCashFlow> {
  const p = buscarProyecto(id)!;
  const avisos: string[] = [];
  const [grilla, serie, hoy] = await Promise.all([
    grillaCashFlow(id, opciones),
    historicoMep(opciones).then(
      (r) => r.valor,
      (e: unknown) => (avisos.push(`No pude leer el MEP histórico (${e instanceof Error ? e.message : String(e)}): los montos en la otra moneda pueden faltar.`), []),
    ),
    dolarHoy(opciones).then(
      (r) => r.valor.cotizaciones.find((c) => c.casa === "mep")?.venta ?? null,
      () => null,
    ),
  ]);
  const mep = mepDeSerie(serie, hoy);
  const madre = leerCashFlowMadre(grilla.filas);
  avisos.push(...madre.avisos);
  const proyectado = proyectadoEnPesos(madre.partidas, mep);

  // Lo real: los cobros y las cajas son del proyecto principal (los únicos cargados por ahora).
  let real: Partida[] = [];
  if (id === PROYECTO_PRINCIPAL.id) {
    const [cuentas, caja] = await Promise.all([
      cuentasCorrientes(opciones).catch((e: unknown) => (avisos.push(`No pude leer los cobros: ${e instanceof Error ? e.message : String(e)}`), null)),
      cajaEgresos(opciones).catch((e: unknown) => (avisos.push(`No pude leer las cajas: ${e instanceof Error ? e.message : String(e)}`), null)),
    ]);
    const cobros: Cobro[] = (cuentas?.cuentas.cuentas ?? []).flatMap((c) => c.pagos.map((m) => ({ fecha: m.fecha, moneda: m.moneda, monto: m.monto, concepto: m.concepto, formal: m.formal, inversor: c.inversor, unidad: c.unidad })));
    const clave = p.nombre.toLowerCase().split(/\s+/)[0];
    const egresos = (caja?.caja.egresos ?? []).filter((e) => e.proyecto.toLowerCase().includes(clave));
    const r = cashFlowReal({ cobros, egresos, nombreRubro, mep });
    if (r.sinMep) avisos.push(`${r.sinMep} movimientos sin MEP del día: en la otra moneda quedan en 0.`);
    real = r.partidas;
  }
  const mesActual = hoyBuenosAires().slice(0, 7);
  const act = actualizado(proyectado, real, mesActual);
  return { meses: rangoDeMeses(madre.meses, real), mesActual, proyectado, real, actualizado: act, mepHoy: hoy, avisos, leido: grilla.leido };
}
