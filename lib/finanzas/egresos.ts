/**
 * Egresos de Mindlin, leídos de las pestañas de caja: "Caja Flujos en Pesos" y
 * "Caja Flujos en Dólares Global". Son los pagos que realmente salieron, en las dos monedas.
 *
 * El rubro sale de la descripción (texto libre) con las reglas de RUBROS, y si ninguna aplica,
 * de la categoría de la planilla. Los movimientos de plata que no son gasto (compra de dólares,
 * FIMA, transferencias entre cuentas) se separan como "internos". Ver docs/finanzas-egresos.md.
 *
 * Todo lo de acá es puro (sin red): lo usan la ruta de la API, la pantalla y los tests.
 */

import { mesDeFecha, sumarMeses, type BlancoNegro, type Celda, type Moneda } from "./ingresos";

export type IdRubro =
  | "terreno"
  | "constructora"
  | "hormigon"
  | "hierro"
  | "materiales"
  | "electricidad"
  | "derechos"
  | "honorarios"
  | "impuestos"
  | "seguros"
  | "bancarios"
  | "sueldos"
  | "administracion"
  | "servicios"
  | "devoluciones"
  | "prestamos"
  | "sin-clasificar";

interface Regla {
  id: IdRubro;
  nombre: string;
  /** Palabras de la descripción (sin acentos, en minúscula). */
  descripcion?: RegExp;
  /** Categorías de la planilla (columna "Conciliación"), si la descripción no alcanza. */
  categorias?: string[];
}

/**
 * Las reglas, en orden: gana la primera que coincide con la descripción; si ninguna coincide,
 * la primera que tiene la categoría. Para sumar un rubro o corregir uno, se cambia esta lista.
 */
export const RUBROS: Regla[] = [
  { id: "terreno", nombre: "Terreno", descripcion: /compra (de )?lote|comision inmob/ },
  // Plata que se prestó y vuelve (por ejemplo, a Borok): sale de la caja, pero no es un gasto.
  { id: "prestamos", nombre: "Préstamos (se devuelven)", descripcion: /borok|prestamo/ },
  { id: "constructora", nombre: "Constructora (JH / Miranda)", descripcion: /\bjh\b|miranda/ },
  { id: "hormigon", nombre: "Hormigón", descripcion: /hormig/ },
  { id: "hierro", nombre: "Hierro", descripcion: /herpaco|hierro/ },
  { id: "derechos", nombre: "Derechos y tasas de obra", descripcion: /plusval|derechos? de construcc|inicio de obra|permiso de obra/ },
  { id: "electricidad", nombre: "Electricidad", descripcion: /electric|transformador/ },
  { id: "materiales", nombre: "Materiales varios", descripcion: /costa materiales|corralon|materiales|ferreter|\bmeli\b|mercado libre/, categorias: ["materiales"] },
  { id: "devoluciones", nombre: "Devoluciones", descripcion: /devoluci/ },
  { id: "sueldos", nombre: "Sueldos y autónomos", descripcion: /sueldo|autonomos/, categorias: ["sueldos"] },
  { id: "seguros", nombre: "Seguros", descripcion: /seguro|federacion patronal|mercantil andina|rivadavia/, categorias: ["seguros"] },
  {
    id: "honorarios",
    nombre: "Honorarios profesionales",
    descripcion: /honorario|contador|escriban|abogad|gestor|empalizada|epcir|assad|busca|renderista|seg(uridad)? (e|y) hig|certificado firmas/,
    categorias: ["honorarios"],
  },
  { id: "impuestos", nombre: "Impuestos", descripcion: /\bvep\b|\biibb\b|sellos|\babl\b|arca|afip|\bdeb\b|\bcred\b|\bimp\b/, categorias: ["impuestos"] },
  { id: "bancarios", nombre: "Gastos bancarios", descripcion: /comision|caja (de )?seg|mantenimiento cuenta/, categorias: ["gastos bancarios"] },
  { id: "administracion", nombre: "Gastos administrativos", categorias: ["gastos administrativos"] },
  { id: "servicios", nombre: "Otros servicios de terceros", categorias: ["servicios de terceros"] },
];

export const SIN_CLASIFICAR = { id: "sin-clasificar" as const, nombre: "Sin clasificar" };

export function nombreRubro(id: IdRubro): string {
  return RUBROS.find((r) => r.id === id)?.nombre ?? SIN_CLASIFICAR.nombre;
}

/** Movimientos que no son gasto: la plata cambia de forma o de cuenta, pero no sale de la empresa. */
const INTERNOS: { tipo: string; descripcion: RegExp }[] = [
  { tipo: "Compra y venta de dólares", descripcion: /(compra|venta)( de)? dolar|cambio( de)? divisa|dolar mep/ },
  { tipo: "FIMA (inversión)", descripcion: /fima/ },
  {
    tipo: "Transferencias entre cuentas propias",
    descripcion: /interbank|cuentas propias|\b(transferencia|trans|transf|tranf|trasnf)( a)? (mp|mercado pago|galicia|nacion|mindlin)\b/,
  },
  { tipo: "Extracciones y caja chica", descripcion: /extraccion|caja chica/ },
];

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function clasificar(descripcion: string, categoria: string): IdRubro {
  const d = normalizar(descripcion);
  const c = normalizar(categoria);
  return (
    RUBROS.find((r) => r.descripcion?.test(d))?.id ??
    RUBROS.find((r) => r.categorias?.includes(c))?.id ??
    SIN_CLASIFICAR.id
  );
}

export function tipoInterno(descripcion: string, categoria: string): string | null {
  const d = normalizar(descripcion);
  const interno = INTERNOS.find((i) => i.descripcion.test(d));
  if (interno) return interno.tipo;
  return normalizar(categoria) === "valores a depositar" ? "FIMA (inversión)" : null;
}

export interface Egreso {
  /** "2026-03-14". Null si la fila no tiene fecha. */
  fecha: string | null;
  mes: string | null;
  descripcion: string;
  /** La categoría de la planilla (columna "Conciliación"). */
  categoria: string;
  rubro: IdRubro;
  /** "Lerma 439", "HQ"… (columna "Corresponde"). */
  proyecto: string;
  bn: BlancoNegro | null;
  moneda: Moneda;
  /** Siempre positivo. */
  monto: number;
  forma: string;
  banco: string;
  pestania: string;
  fila: number;
}

export interface Interno extends Egreso {
  tipo: string;
}

export type TipoAvisoEgreso = "sin-clasificar" | "signo" | "sin-fecha" | "sin-bn" | "dato-raro";

export interface AvisoEgreso {
  tipo: TipoAvisoEgreso;
  titulo: string;
  detalle: string;
  pestania: string;
  /** Filas de la planilla (desde 1). */
  filas: number[];
  monto: number | null;
  moneda: Moneda | null;
}

export interface CajaEgresos {
  egresos: Egreso[];
  internos: Interno[];
  avisos: AvisoEgreso[];
  mesActual: string;
}

/** La fecha de una celda: número de serie de Sheets o texto "dd/mm/aaaa". */
export function diaDeFecha(valor: number | string | null): string | null {
  if (typeof valor === "number" && valor > 0 && valor < 100000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof valor === "string") {
    const m = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      // Solo fechas que existen: "31/06/2026" no.
      const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
      if (d.getUTCDate() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1) return d.toISOString().slice(0, 10);
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(valor.trim())) return valor.trim().slice(0, 10);
  }
  return null;
}

function listaFilas(filas: number[]): string {
  return filas.length <= 6 ? `fila${filas.length > 1 ? "s" : ""} ${filas.join(", ")}` : `${filas.length} filas (${filas.slice(0, 4).join(", ")}…)`;
}

/**
 * Lee una pestaña de caja (fila 1 de encabezados) y devuelve sus egresos.
 * Si faltan columnas que se necesitan, tira un error que dice cuáles.
 */
export function leerCaja(filas: Celda[][], moneda: Moneda, pestania: string, mesActual: string): CajaEgresos {
  const encabezados = (filas[0] ?? []).map((c) => normalizar(c.valor));
  const col = (...nombres: string[]) => encabezados.findIndex((e) => nombres.includes(e));
  const c = {
    fecha: col("fecha"),
    tipo: col("tipo de operacion"),
    descripcion: col("rubro/descripcion", "nota"),
    categoria: col("conciliacion"),
    proyecto: col("corresponde"),
    forma: col("forma de pago/cobro"),
    bn: col("legalidad"),
    banco: col("banco"),
    importe: col("importe total"),
  };
  const faltan = Object.entries({
    Fecha: c.fecha,
    "Tipo de Operación": c.tipo,
    "Rubro/Descripción": c.descripcion,
    Legalidad: c.bn,
    "Importe Total": c.importe,
  }).filter(([, i]) => i < 0);
  if (faltan.length) throw new Error(`A la pestaña "${pestania}" le faltan las columnas: ${faltan.map(([n]) => `"${n}"`).join(", ")}.`);

  const txt = (fila: Celda[], i: number) => (i < 0 || fila[i]?.valor == null ? "" : String(fila[i].valor).trim());
  const filasEgreso = filas
    .map((fila, i) => ({ fila, nro: i + 1 }))
    .slice(1)
    .filter(({ fila }) => normalizar(fila[c.tipo]?.valor) === "egreso");

  // Cada pestaña anota los egresos con su signo (en pesos van en negativo, en dólares en positivo).
  // Lo que tiene el signo al revés suele ser plata que entró, cargada como egreso.
  const importes = filasEgreso.map(({ fila }) => fila[c.importe]?.valor).filter((v): v is number => typeof v === "number" && v !== 0);
  const signo = importes.filter((v) => v < 0).length > importes.length / 2 ? -1 : 1;

  const egresos: Egreso[] = [];
  const internos: Interno[] = [];
  const problemas = new Map<TipoAvisoEgreso, { filas: number[]; total: number; ejemplos: Set<string> }>();
  const anotar = (t: TipoAvisoEgreso, fila: number, monto: number, ejemplo: string) => {
    const p = problemas.get(t) ?? { filas: [], total: 0, ejemplos: new Set<string>() };
    p.filas.push(fila);
    p.total += monto;
    if (ejemplo) p.ejemplos.add(ejemplo);
    problemas.set(t, p);
  };
  const sinClasificar = new Map<string, { descripcion: string; filas: number[]; total: number }>();

  for (const { fila, nro } of filasEgreso) {
    const descripcion = txt(fila, c.descripcion);
    const importe = fila[c.importe]?.valor;
    if (typeof importe !== "number") {
      anotar("dato-raro", nro, 0, descripcion);
      continue;
    }
    if (importe === 0) continue;
    const categoria = txt(fila, c.categoria);
    const interno = tipoInterno(descripcion, categoria);
    if (!interno && Math.sign(importe) !== signo) {
      anotar("signo", nro, Math.abs(importe), descripcion);
      continue;
    }
    const bnTexto = normalizar(fila[c.bn]?.valor);
    const fecha = diaDeFecha(fila[c.fecha]?.valor ?? null);
    const e: Egreso = {
      fecha,
      mes: fecha?.slice(0, 7) ?? mesDeFecha(fila[c.fecha]?.valor ?? null),
      descripcion,
      categoria,
      rubro: clasificar(descripcion, categoria),
      proyecto: txt(fila, c.proyecto) || "Sin proyecto",
      bn: bnTexto === "blanco" ? "blanco" : bnTexto === "negro" ? "negro" : null,
      moneda,
      monto: Math.abs(importe),
      forma: txt(fila, c.forma),
      banco: txt(fila, c.banco),
      pestania,
      fila: nro,
    };
    if (interno) {
      internos.push({ ...e, tipo: interno });
      continue;
    }
    egresos.push(e);
    if (!e.fecha) anotar("sin-fecha", nro, e.monto, descripcion);
    if (!e.bn) anotar("sin-bn", nro, e.monto, descripcion);
    if (e.rubro === "sin-clasificar") {
      const clave = normalizar(descripcion) || "(sin descripción)";
      const g = sinClasificar.get(clave) ?? { descripcion: descripcion || "(sin descripción)", filas: [], total: 0 };
      g.filas.push(nro);
      g.total += e.monto;
      sinClasificar.set(clave, g);
    }
  }

  const textos: Record<Exclude<TipoAvisoEgreso, "sin-clasificar">, (p: { filas: number[]; ejemplos: Set<string> }) => { titulo: string; detalle: string }> = {
    signo: (p) => ({
      titulo: "Egreso con el signo al revés: ¿es un ingreso?",
      detalle: `${[...p.ejemplos].slice(0, 4).join(", ")}. No se cuenta como egreso hasta corregirlo.`,
    }),
    "sin-fecha": (p) => ({
      titulo: "Egresos sin fecha",
      detalle: `${[...p.ejemplos].slice(0, 3).join(", ")}. Se cuentan en los totales, pero no se pueden ubicar en un mes.`,
    }),
    "sin-bn": (p) => ({
      titulo: "Egresos sin blanco o negro",
      detalle: `${[...p.ejemplos].slice(0, 3).join(", ")}. Se cuentan como "sin dato".`,
    }),
    "dato-raro": (p) => ({
      titulo: "Importe que no es un número",
      detalle: `${[...p.ejemplos].slice(0, 3).join(", ")}. No se cuenta.`,
    }),
  };
  const avisos: AvisoEgreso[] = [];
  for (const [t, p] of problemas) {
    if (t === "sin-clasificar") continue;
    avisos.push({ tipo: t, ...textos[t](p), pestania, filas: p.filas, monto: t === "dato-raro" ? null : p.total, moneda });
  }
  for (const g of [...sinClasificar.values()].sort((a, b) => b.total - a.total)) {
    avisos.push({
      tipo: "sin-clasificar",
      titulo: `Sin rubro: "${g.descripcion}"`,
      detalle: `No entra en ningún rubro (${listaFilas(g.filas)}). Se cuenta como "Sin clasificar".`,
      pestania,
      filas: g.filas,
      monto: g.total,
      moneda,
    });
  }

  return { egresos, internos, avisos, mesActual };
}

/** Junta las dos cajas. */
export function unir(...cajas: CajaEgresos[]): CajaEgresos {
  return {
    egresos: cajas.flatMap((c) => c.egresos),
    internos: cajas.flatMap((c) => c.internos),
    avisos: cajas.flatMap((c) => c.avisos),
    mesActual: cajas[0]?.mesActual ?? "",
  };
}

// ---------- Filtros ----------

export interface FiltrosEgresos {
  desde: string | null;
  hasta: string | null;
  moneda: Moneda | null;
  bn: BlancoNegro | null;
  rubro: IdRubro | null;
  proyecto: string | null;
  /** Busca en la descripción. */
  q: string | null;
}

export const SIN_FILTROS_EGRESOS: FiltrosEgresos = { desde: null, hasta: null, moneda: null, bn: null, rubro: null, proyecto: null, q: null };

const IDS = [...RUBROS.map((r) => r.id), SIN_CLASIFICAR.id] as IdRubro[];

export function filtrosEgresosDeUrl(p: URLSearchParams): FiltrosEgresos {
  const mes = (v: string | null) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null);
  const moneda = p.get("moneda");
  const bn = p.get("bn");
  const rubro = p.get("rubro") as IdRubro | null;
  return {
    desde: mes(p.get("desde")),
    hasta: mes(p.get("hasta")),
    moneda: moneda === "ARS" || moneda === "USD" ? moneda : null,
    bn: bn === "blanco" || bn === "negro" ? bn : null,
    rubro: rubro && IDS.includes(rubro) ? rubro : null,
    proyecto: p.get("proyecto") || null,
    q: p.get("q")?.trim() || null,
  };
}

export function filtrosEgresosAUrl(f: FiltrosEgresos): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p.toString();
}

/** Con un rango de fechas, los egresos sin fecha quedan afuera. */
export function filtrarEgresos<T extends Egreso>(egresos: T[], f: FiltrosEgresos): T[] {
  const q = f.q ? normalizar(f.q) : null;
  return egresos.filter(
    (e) =>
      (!f.desde || (e.mes != null && e.mes >= f.desde)) &&
      (!f.hasta || (e.mes != null && e.mes <= f.hasta)) &&
      (!f.moneda || e.moneda === f.moneda) &&
      (!f.bn || e.bn === f.bn) &&
      (!f.rubro || e.rubro === f.rubro) &&
      (!f.proyecto || e.proyecto === f.proyecto) &&
      (!q || normalizar(e.descripcion).includes(q)),
  );
}

// ---------- Totales ----------

export interface TotalEgresos {
  total: number;
  blanco: number;
  negro: number;
  sinDato: number;
  cantidad: number;
}

const vacio = (): TotalEgresos => ({ total: 0, blanco: 0, negro: 0, sinDato: 0, cantidad: 0 });

function sumar(t: TotalEgresos, e: Egreso) {
  t.total += e.monto;
  if (e.bn === "blanco") t.blanco += e.monto;
  else if (e.bn === "negro") t.negro += e.monto;
  else t.sinDato += e.monto;
  t.cantidad++;
}

export function totalesEgresos(egresos: Egreso[]): Record<Moneda, TotalEgresos> {
  const r = { ARS: vacio(), USD: vacio() };
  for (const e of egresos) sumar(r[e.moneda], e);
  return r;
}

export interface FilaRubro extends TotalEgresos {
  rubro: IdRubro;
  nombre: string;
  /** Parte del total de la moneda, de 0 a 1. */
  parte: number;
}

/** Lo gastado por rubro en una moneda, de mayor a menor. */
export function porRubro(egresos: Egreso[], moneda: Moneda): FilaRubro[] {
  const grupos = new Map<IdRubro, TotalEgresos>();
  for (const e of egresos) {
    if (e.moneda !== moneda) continue;
    const t = grupos.get(e.rubro) ?? vacio();
    sumar(t, e);
    grupos.set(e.rubro, t);
  }
  const total = [...grupos.values()].reduce((s, t) => s + t.total, 0);
  return [...grupos]
    .map(([rubro, t]) => ({ rubro, nombre: nombreRubro(rubro), ...t, parte: total ? t.total / total : 0 }))
    .sort((a, b) => b.total - a.total);
}

export interface FilaConcepto {
  descripcion: string;
  total: number;
  cantidad: number;
}

/** Los conceptos (descripciones) que más plata se llevaron en una moneda; el resto, en "Otros". */
export function porConcepto(egresos: Egreso[], moneda: Moneda, cuantos = 10): { filas: FilaConcepto[]; otros: FilaConcepto | null } {
  const grupos = new Map<string, FilaConcepto>();
  for (const e of egresos) {
    if (e.moneda !== moneda) continue;
    const clave = normalizar(e.descripcion) || "(sin descripción)";
    const g = grupos.get(clave) ?? { descripcion: e.descripcion || "(sin descripción)", total: 0, cantidad: 0 };
    g.total += e.monto;
    g.cantidad++;
    grupos.set(clave, g);
  }
  const todos = [...grupos.values()].sort((a, b) => b.total - a.total);
  const resto = todos.slice(cuantos);
  return {
    filas: todos.slice(0, cuantos),
    otros: resto.length ? { descripcion: `Otros (${resto.length} conceptos)`, total: resto.reduce((s, g) => s + g.total, 0), cantidad: resto.reduce((s, g) => s + g.cantidad, 0) } : null,
  };
}

export interface MesEgresos {
  mes: string;
  blanco: number;
  negro: number;
  sinDato: number;
  total: number;
  acumulado: number;
}

/** Lo de una moneda, mes por mes y sin huecos, del primer al último mes (o del rango pedido). */
export function egresosPorMes(egresos: Egreso[], moneda: Moneda, desde?: string | null, hasta?: string | null): MesEgresos[] {
  const conMes = egresos.filter((e) => e.moneda === moneda && e.mes);
  if (!conMes.length) return [];
  const meses = conMes.map((e) => e.mes!).sort();
  const inicio = desde ?? meses[0];
  const fin = hasta ?? meses.at(-1)!;
  const r: MesEgresos[] = [];
  for (let m = inicio, acumulado = 0; m <= fin; m = sumarMeses(m, 1)) {
    const t = vacio();
    for (const e of conMes) if (e.mes === m) sumar(t, e);
    acumulado += t.total;
    r.push({ mes: m, blanco: t.blanco, negro: t.negro, sinDato: t.sinDato, total: t.total, acumulado });
  }
  return r;
}

/** Totales de los movimientos internos por tipo y moneda. */
export function resumenInternos(internos: Interno[]): { tipo: string; moneda: Moneda; total: number; cantidad: number }[] {
  const grupos = new Map<string, { tipo: string; moneda: Moneda; total: number; cantidad: number }>();
  for (const i of internos) {
    const clave = `${i.tipo}|${i.moneda}`;
    const g = grupos.get(clave) ?? { tipo: i.tipo, moneda: i.moneda, total: 0, cantidad: 0 };
    g.total += i.monto;
    g.cantidad++;
    grupos.set(clave, g);
  }
  return [...grupos.values()].sort((a, b) => a.moneda.localeCompare(b.moneda) || b.total - a.total);
}

/** Los egresos en CSV para Excel en español: separador ";", coma decimal y BOM para los acentos. */
export function egresosACsv(egresos: Egreso[]): string {
  const celda = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const filas = [
    ["Fecha", "Descripción", "Rubro", "Categoría en la planilla", "Proyecto", "Blanco/Negro", "Moneda", "Monto", "Forma de pago", "Banco", "Pestaña", "Fila"],
    ...egresos.map((e) => [
      e.fecha ?? "",
      e.descripcion,
      nombreRubro(e.rubro),
      e.categoria,
      e.proyecto,
      e.bn === "blanco" ? "Blanco" : e.bn === "negro" ? "Negro" : "",
      e.moneda,
      e.monto.toFixed(2).replace(".", ","),
      e.forma,
      e.banco,
      e.pestania,
      String(e.fila),
    ]),
  ];
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
}
