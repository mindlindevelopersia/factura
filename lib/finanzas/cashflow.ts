/**
 * El cash flow del proyecto, mes a mes: proyectado, real y "actualizado" (real hasta el mes pasado
 * y proyectado de acá en adelante), en dólares o en pesos.
 *
 * - Proyectado: la pestaña "Cash Flow" del Excel madre (en dólares, con IVA): ingresos (anticipos,
 *   arqueo, refuerzos en blanco y en negro, cuotas) y egresos por rubro (terreno, obra,
 *   equipamiento, honorarios y gestiones, otros), más el IVA y los impuestos.
 * - Real: lo cobrado (cada pago de "Pagos por Inversor") y lo pagado (los egresos de las cajas del
 *   proyecto, agrupados en los mismos rubros que el Excel madre).
 * - Pesos y dólares: lo real se pasa al MEP del día de cada pago; lo proyectado, al MEP del mes (los
 *   meses que vienen, al MEP de hoy).
 *
 * Todo puro (sin red).
 */

import type { Egreso, IdRubro } from "./egresos";
import { mesDeFecha, sumarMeses, type Celda, type Moneda } from "./ingresos";

export type TipoPartida = "ingreso" | "egreso";

/** Los grupos, en el orden en que se muestran. */
export const GRUPOS: { clave: string; nombre: string; tipo: TipoPartida }[] = [
  { clave: "anticipos", nombre: "Anticipos", tipo: "ingreso" },
  { clave: "cuotas", nombre: "Cuotas", tipo: "ingreso" },
  { clave: "refuerzos", nombre: "Refuerzos", tipo: "ingreso" },
  { clave: "otros-ingresos", nombre: "Otros cobros", tipo: "ingreso" },
  { clave: "terreno", nombre: "Terreno", tipo: "egreso" },
  { clave: "obra", nombre: "Obra (hard costs)", tipo: "egreso" },
  { clave: "equipamiento", nombre: "Equipamiento y ascensores", tipo: "egreso" },
  { clave: "honorarios", nombre: "Honorarios y gestiones (soft costs)", tipo: "egreso" },
  { clave: "otros", nombre: "Impuestos, seguros y otros", tipo: "egreso" },
  { clave: "iva", nombre: "IVA e ingresos brutos", tipo: "egreso" },
  { clave: "devoluciones", nombre: "Devoluciones", tipo: "egreso" },
  { clave: "prestamos", nombre: "Préstamos (se devuelven)", tipo: "egreso" },
  { clave: "sin-clasificar", nombre: "Sin clasificar", tipo: "egreso" },
];

export interface Movimiento {
  fecha: string;
  texto: string;
  moneda: Moneda;
  monto: number;
  usd: number;
  ars: number;
}

export interface Partida {
  clave: string;
  nombre: string;
  grupo: string;
  tipo: TipoPartida;
  /** Por mes ("2026-03"): siempre positivo (lo que entra o lo que sale). */
  usd: Record<string, number>;
  ars: Record<string, number>;
  /** Los movimientos (solo en lo real), para ver de qué sale cada número. */
  movimientos?: Movimiento[];
}

export interface CashFlow {
  meses: string[];
  partidas: Partida[];
}

/** El MEP de un día ("2026-03-14") o de un mes ("2026-03"): el último publicado hasta ahí. */
export type Mep = (fecha: string) => number | null;

/** Arma el MEP a partir de la serie histórica ([{fecha, venta}]). Sin dato antes del primero, usa el primero. */
export function mepDeSerie(serie: { fecha: string; venta: number }[], hoy: number | null): Mep {
  const s = serie.filter((x) => x.fecha && x.venta > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return (fecha) => {
    const f = fecha.length === 7 ? `${fecha}-15` : fecha;
    if (!s.length) return hoy;
    if (f > s[s.length - 1].fecha) return hoy ?? s[s.length - 1].venta;
    let lo = 0;
    let hi = s.length - 1;
    while (lo < hi) {
      const m = Math.ceil((lo + hi) / 2);
      if (s[m].fecha <= f) lo = m;
      else hi = m - 1;
    }
    return s[lo].fecha <= f ? s[lo].venta : s[0].venta;
  };
}

const numero = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const texto = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const sumar = (r: Record<string, number>, mes: string, v: number) => {
  if (v) r[mes] = (r[mes] ?? 0) + v;
};

/**
 * Lee la pestaña "Cash Flow" del Excel madre. Devuelve las partidas en dólares (los pesos se
 * completan después con el MEP) y avisos si algo no cierra.
 */
export function leerCashFlowMadre(filas: Celda[][]): { meses: string[]; partidas: Partida[]; avisos: string[] } {
  const avisos: string[] = [];
  // La fila de los meses: la primera con 6 o más fechas.
  let columnas: { i: number; mes: string }[] = [];
  for (const f of filas.slice(0, 10)) {
    const c = f.map((x, i) => ({ i, mes: mesDeFecha(x.valor) })).filter((x): x is { i: number; mes: string } => !!x.mes && x.i > 2);
    if (c.length >= 6) {
      columnas = c;
      break;
    }
  }
  if (!columnas.length) return { meses: [], partidas: [], avisos: ['La pestaña "Cash Flow" no tiene la fila de los meses.'] };
  const meses = [...new Set(columnas.map((c) => c.mes))];
  const valores = (f: Celda[]) => {
    const r: Record<string, number> = {};
    for (const c of columnas) sumar(r, c.mes, numero(f[c.i]?.valor));
    return r;
  };
  const partidas: Partida[] = [];
  const agregar = (clave: string, nombre: string, grupo: string, tipo: TipoPartida, usd: Record<string, number>) => {
    if (Object.values(usd).some((v) => Math.abs(v) > 0.005)) partidas.push({ clave, nombre, grupo, tipo, usd, ars: {} });
  };

  let seccion: "nada" | "ingresos" | "egresos" = "nada";
  let grupo = "obra";
  let resultado: Record<string, number> | null = null;
  filas.forEach((f, n) => {
    const nombre = String(f[0]?.valor ?? "").trim();
    const t = texto(nombre);
    if (!t) return;
    if (/^ingresos c\/iva en dolares/.test(t)) return void (seccion = "ingresos");
    if (/^total egresos c\/iva$/.test(t) || /^egresos c\/iva en dolares/.test(t)) return void (seccion = "egresos");
    if (/^total ingresos/.test(t) || /^total egresos mensuales/.test(t)) return void (seccion = "nada");
    if (/^iva total en dolares/.test(t)) {
      const v = valores(f);
      agregar("iva", "IVA (débito − crédito)", "iva", "egreso", Object.fromEntries(Object.entries(v).map(([m, x]) => [m, -x])));
      return;
    }
    if (/^total egresos en impuestos/.test(t)) return agregar("iibb", "Ingresos brutos y otros impuestos", "iva", "egreso", valores(f));
    if (/^resultado por periodo/.test(t)) return void (resultado = valores(f));
    if (seccion === "ingresos") {
      const g = /anticip|arqueo/.test(t) ? "anticipos" : /cuota/.test(t) ? "cuotas" : /refuerzo/.test(t) ? "refuerzos" : "otros-ingresos";
      agregar(`p-ing-${n}`, nombre, g, "ingreso", valores(f));
    } else if (seccion === "egresos") {
      if (/^terreno$/.test(t)) grupo = "terreno";
      else if (/^hard costs/.test(t)) grupo = "obra";
      else if (/^equipamiento y ascensores/.test(t)) grupo = "equipamiento";
      else if (/^soft costs/.test(t)) grupo = "honorarios";
      else if (/^others? cost$/.test(t)) grupo = "otros";
      if (/total/.test(t)) return;
      agregar(`p-egr-${n}`, nombre, grupo, "egreso", valores(f));
    }
  });

  // Control: ingresos − egresos tiene que dar el "RESULTADO por Período" de la planilla.
  if (resultado) {
    const r: Record<string, number> = resultado;
    const malos = meses.filter((m) => {
      const neto = partidas.reduce((s, p) => s + (p.tipo === "ingreso" ? 1 : -1) * (p.usd[m] ?? 0), 0);
      return Math.abs(neto - (r[m] ?? 0)) > 1;
    });
    if (malos.length) avisos.push(`El proyectado no da igual que "RESULTADO por Período" del Excel madre en ${malos.length} ${malos.length === 1 ? "mes" : "meses"} (por ejemplo ${malos[0]}): puede que la pestaña haya cambiado de forma.`);
  }
  return { meses, partidas, avisos };
}

/** Completa los pesos de lo proyectado: cada mes al MEP de ese mes (los que vienen, al de hoy). */
export function proyectadoEnPesos(partidas: Partida[], mep: Mep): Partida[] {
  return partidas.map((p) => ({ ...p, ars: Object.fromEntries(Object.entries(p.usd).map(([m, v]) => [m, v * (mep(m) ?? 0)])) }));
}

/** Los rubros de la caja, en los grupos del Excel madre. */
export const GRUPO_DE_RUBRO: Record<IdRubro, string> = {
  terreno: "terreno",
  constructora: "obra",
  hormigon: "obra",
  hierro: "obra",
  materiales: "obra",
  electricidad: "obra",
  derechos: "honorarios",
  honorarios: "honorarios",
  impuestos: "otros",
  seguros: "otros",
  bancarios: "otros",
  sueldos: "otros",
  administracion: "otros",
  servicios: "otros",
  devoluciones: "devoluciones",
  prestamos: "prestamos",
  "sin-clasificar": "sin-clasificar",
};

/** Un pago cobrado (de "Pagos por Inversor"). */
export interface Cobro {
  fecha: string | null;
  moneda: Moneda;
  monto: number;
  concepto: string;
  formal: boolean | null;
  inversor: string;
  unidad: string;
}

/** Lo real: lo cobrado y lo pagado (egresos del proyecto), en dólares y pesos al MEP del día. */
export function cashFlowReal(o: { cobros: Cobro[]; egresos: Egreso[]; nombreRubro: (id: IdRubro) => string; mep: Mep }): { partidas: Partida[]; sinMep: number } {
  const porClave = new Map<string, Partida>();
  let sinMep = 0;
  const poner = (clave: string, nombre: string, grupo: string, tipo: TipoPartida, fecha: string, moneda: Moneda, monto: number, detalle: string) => {
    const tc = o.mep(fecha);
    if (!tc) sinMep++;
    const usd = moneda === "USD" ? monto : tc ? monto / tc : 0;
    const ars = moneda === "ARS" ? monto : tc ? monto * tc : 0;
    const mes = fecha.slice(0, 7);
    let p = porClave.get(clave);
    if (!p) porClave.set(clave, (p = { clave, nombre, grupo, tipo, usd: {}, ars: {}, movimientos: [] }));
    sumar(p.usd, mes, usd);
    sumar(p.ars, mes, ars);
    p.movimientos!.push({ fecha, texto: detalle, moneda, monto, usd, ars });
  };
  for (const c of o.cobros) {
    if (!c.fecha || !(c.monto > 0)) continue;
    const t = texto(c.concepto);
    const [clave, nombre, grupo] = /cuota/.test(t)
      ? ["r-cuotas", "Cuotas", "cuotas"]
      : /refuerzo/.test(t)
        ? c.formal === false
          ? ["r-ref-negro", "Refuerzos en negro", "refuerzos"]
          : ["r-ref-blanco", "Refuerzos en blanco", "refuerzos"]
        : /anticip|arqueo|sena|aporte inicial|pago unico/.test(t)
          ? ["r-anticipos", "Anticipos y aportes iniciales", "anticipos"]
          : /certificaci/.test(t)
            ? ["r-certificaciones", "Certificaciones", "otros-ingresos"]
            : ["r-otros", "Otros cobros (adicionales, varios)", "otros-ingresos"];
    poner(clave, nombre, grupo, "ingreso", c.fecha, c.moneda, c.monto, `${c.inversor}${c.unidad ? ` · ${c.unidad}` : ""}${c.concepto ? ` · ${c.concepto}` : ""}`);
  }
  for (const e of o.egresos) {
    if (!e.fecha || !(e.monto > 0)) continue;
    poner(`r-${e.rubro}`, o.nombreRubro(e.rubro), GRUPO_DE_RUBRO[e.rubro] ?? "sin-clasificar", "egreso", e.fecha, e.moneda, e.monto, e.descripcion || e.categoria);
  }
  for (const p of porClave.values()) p.movimientos!.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { partidas: [...porClave.values()], sinMep };
}

/** Real hasta el mes anterior a `desde` y proyectado de `desde` en adelante. */
export function actualizado(proyectado: Partida[], real: Partida[], desde: string): Partida[] {
  const corte = (p: Partida, antes: boolean): Partida => {
    const filtro = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).filter(([m]) => (antes ? m < desde : m >= desde)));
    return { ...p, usd: filtro(p.usd), ars: filtro(p.ars), movimientos: p.movimientos?.filter((x) => (antes ? x.fecha.slice(0, 7) < desde : x.fecha.slice(0, 7) >= desde)) };
  };
  return [...real.map((p) => corte(p, true)), ...proyectado.map((p) => corte(p, false))].filter((p) => Object.keys(p.usd).length);
}

/** Todos los meses entre el primero y el último con algo (sin huecos). */
export function rangoDeMeses(...listas: (string[] | Partida[])[]): string[] {
  const todos = listas.flatMap((l) => l.flatMap((x) => (typeof x === "string" ? [x] : Object.keys(x.usd))));
  if (!todos.length) return [];
  todos.sort();
  const r: string[] = [];
  for (let m = todos[0]; m <= todos[todos.length - 1]; m = sumarMeses(m, 1)) r.push(m);
  return r;
}

export interface Totales {
  ingresos: Record<string, number>;
  egresos: Record<string, number>;
  neto: Record<string, number>;
  acumulado: Record<string, number>;
  porGrupo: Record<string, Record<string, number>>;
  total: { ingresos: number; egresos: number; neto: number };
}

export function totales(partidas: Partida[], meses: string[], moneda: Moneda): Totales {
  const campo = moneda === "USD" ? "usd" : "ars";
  const t: Totales = { ingresos: {}, egresos: {}, neto: {}, acumulado: {}, porGrupo: {}, total: { ingresos: 0, egresos: 0, neto: 0 } };
  for (const p of partidas) {
    const g = (t.porGrupo[p.grupo] ??= {});
    for (const m of meses) {
      const v = p[campo][m] ?? 0;
      if (!v) continue;
      sumar(g, m, v);
      sumar(p.tipo === "ingreso" ? t.ingresos : t.egresos, m, v);
    }
  }
  let acumulado = 0;
  for (const m of meses) {
    const neto = (t.ingresos[m] ?? 0) - (t.egresos[m] ?? 0);
    t.neto[m] = neto;
    acumulado += neto;
    t.acumulado[m] = acumulado;
    t.total.ingresos += t.ingresos[m] ?? 0;
    t.total.egresos += t.egresos[m] ?? 0;
  }
  t.total.neto = t.total.ingresos - t.total.egresos;
  return t;
}
