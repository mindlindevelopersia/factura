/**
 * Ingresos del proyecto Lerma, leídos de la pestaña "Flujo de fondos LERMA".
 *
 * La pestaña tiene una fila por inversor × tipo de pago × blanco/negro × moneda y una columna
 * por mes. Lo cobrado no está en una columna: lo marca el color de fondo de cada celda
 * (verde cobrado, rosa a cobrar). Ver docs/finanzas-ingresos.md.
 *
 * Todo lo de acá es puro (sin red): lo usan la ruta de la API, la pantalla y los tests.
 */

export type Color = "verde" | "rosa" | "amarillo" | "celeste" | "otro" | null;
export type Moneda = "ARS" | "USD";
export type BlancoNegro = "blanco" | "negro";
export type TipoPago = "anticipo" | "cuota" | "refuerzo";
export type Estado = "cobrado" | "a-cobrar";

export interface Celda {
  valor: number | string | null;
  color: Color;
}

export interface Pago {
  inversor: string;
  unidad: string;
  tipo: TipoPago;
  /** Como figura en la planilla: "Cuota mensual", "Refuerzo 2", "Anticipo". */
  detalle: string;
  bn: BlancoNegro;
  moneda: Moneda;
  /** "2026-03". Null si no se sabe el mes (un anticipo sin mes base CAC). */
  mes: string | null;
  monto: number;
  estado: Estado;
  /** A cobrar de un mes que ya pasó. */
  atrasado: boolean;
  /** Celda de la planilla, "AF8", para ir a buscarla. */
  celda: string;
  /** Color de fondo de la celda (amarillo: hay que actualizar el monto). */
  color?: Color;
  /** "Mes Base CAC" de la fila: desde ahí se ajustan los refuerzos. */
  mesBase?: string | null;
}

export type TipoAviso = "atrasado" | "amarillo" | "sin-color" | "falta-vender" | "dato-raro" | "sin-mes-base" | "fila-incompleta" | "total";

/** Algo que una persona tiene que mirar en la planilla. */
export interface Aviso {
  tipo: TipoAviso;
  titulo: string;
  detalle: string;
  inversor: string | null;
  unidad: string | null;
  /** Fila de la planilla (desde 1). */
  fila: number;
  monto: number | null;
  moneda: Moneda | null;
}

export interface FlujoIngresos {
  pagos: Pago[];
  avisos: Aviso[];
  /** "2026-10", en hora de Buenos Aires. Separa lo atrasado de lo que viene. */
  mesActual: string;
}

const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Colores de fondo de la planilla, en RGB de 0 a 1 como los devuelve la API de Sheets. */
const COLORES: [Exclude<Color, "otro" | null>, [number, number, number]][] = [
  ["verde", [0xb6 / 255, 0xd7 / 255, 0xa8 / 255]],
  ["rosa", [0xf4 / 255, 0xcc / 255, 0xcc / 255]],
  ["amarillo", [1, 1, 0]],
  ["celeste", [0xcf / 255, 0xe2 / 255, 0xf3 / 255]],
];

/** El color de fondo de una celda según la API de Sheets (los componentes en 0 no vienen). */
export function colorDe(fondo: { red?: number; green?: number; blue?: number } | undefined | null): Color {
  if (!fondo) return null;
  const rgb = [fondo.red ?? 0, fondo.green ?? 0, fondo.blue ?? 0];
  if (rgb.every((c) => c > 0.99)) return null; // blanco: sin color
  for (const [nombre, ref] of COLORES) {
    if (ref.every((c, i) => Math.abs(c - rgb[i]) < 0.03)) return nombre;
  }
  return "otro";
}

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[?¿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function texto(c: Celda | undefined): string {
  return c?.valor == null ? "" : String(c.valor).trim();
}

/** "Marzo 2025" → "2025-03". */
export function mesDeEncabezado(titulo: unknown): string | null {
  const m = normalizar(titulo).match(/^([a-z]+) (\d{4})$/);
  if (!m) return null;
  const i = NOMBRES_MES.indexOf(m[1] === "setiembre" ? "septiembre" : m[1]);
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, "0")}`;
}

/** El mes de una fecha de la planilla: número de serie de Sheets o texto "dd/mm/aaaa". */
export function mesDeFecha(valor: number | string | null): string | null {
  if (typeof valor === "number" && valor > 0 && valor < 100000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86_400_000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof valor === "string") {
    const m = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[3]}-${m[2].padStart(2, "0")}`;
    const iso = valor.trim().match(/^(\d{4})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}`;
  }
  return null;
}

export function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** El mes de hoy en Buenos Aires. */
export function mesDeHoy(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" })
    .format(ahora)
    .slice(0, 7);
}

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function letra(i: number): string {
  return i < 26 ? LETRAS[i] : letra(Math.floor(i / 26) - 1) + LETRAS[i % 26];
}

export function nombreMes(mes: string, corto = false): string {
  const [a, m] = mes.split("-").map(Number);
  const nombre = NOMBRES_MES[m - 1];
  return corto ? `${nombre.slice(0, 3)} ${String(a).slice(2)}` : `${nombre[0].toUpperCase()}${nombre.slice(1)} ${a}`;
}

function listaMeses(meses: string[]): string {
  if (meses.length <= 3) return meses.map((m) => nombreMes(m)).join(", ");
  return `${nombreMes(meses[0])} a ${nombreMes(meses.at(-1)!)} (${meses.length} meses)`;
}

function tipoDe(t: string): { tipo: TipoPago; detalle: string } | null {
  const n = normalizar(t);
  if (n.startsWith("anticipo")) return { tipo: "anticipo", detalle: "Anticipo" };
  if (n.startsWith("cuota")) return { tipo: "cuota", detalle: "Cuota mensual" };
  const r = n.match(/^refuerzo\s*(\d*)/);
  if (r) return { tipo: "refuerzo", detalle: r[1] ? `Refuerzo ${r[1]}` : "Refuerzo" };
  return null;
}

/**
 * Lee la pestaña (fila 1 de encabezados) y arma los pagos y lo que hay que revisar.
 * Si faltan columnas que se necesitan, tira un error que dice cuáles.
 */
export function leerFlujo(filas: Celda[][], mesActual: string): FlujoIngresos {
  const encabezados = (filas[0] ?? []).map((c) => normalizar(c.valor));
  const col = (...nombres: string[]) => encabezados.findIndex((e) => nombres.includes(e));
  const c = {
    inversor: col("inversores", "inversor"),
    base: col("mes base cac"),
    unidad: col("unidad funcional", "unidad"),
    tipo: col("tipo de pago"),
    bn: col("b o n"),
    moneda: col("moneda"),
    anticipo: col("anticipo usd"),
    totales: col("totales", "total"),
  };
  const faltan = Object.entries({ Inversores: c.inversor, "TIPO DE PAGO": c.tipo, "B o N?": c.bn, "MONEDA?": c.moneda, "ANTICIPO USD": c.anticipo }).filter(([, i]) => i < 0);
  if (faltan.length) throw new Error(`A la pestaña le faltan las columnas: ${faltan.map(([n]) => `"${n}"`).join(", ")}.`);
  const meses = encabezados.map((_, i) => mesDeEncabezado(filas[0][i]?.valor));
  if (!meses.some(Boolean)) throw new Error('La pestaña no tiene columnas de meses ("Marzo 2025", "Abril 2025"…) en la fila 1.');

  const pagos: Pago[] = [];
  const avisos: Aviso[] = [];

  filas.slice(1).forEach((fila, i) => {
    const nroFila = i + 2;
    const inversor = texto(fila[c.inversor]);
    const unidad = c.unidad >= 0 ? texto(fila[c.unidad]) : "";
    const tipoTexto = texto(fila[c.tipo]);

    // Fila de totales: la suma de sus meses tiene que dar lo que dice su total.
    if (!tipoTexto && /^totales/i.test(inversor) && c.totales >= 0) {
      const total = fila[c.totales]?.valor;
      const suma = meses.reduce((s, m, j) => (m && typeof fila[j]?.valor === "number" ? s + (fila[j].valor as number) : s), 0);
      if (typeof total === "number" && Math.abs(total - suma) > 1) {
        avisos.push({
          tipo: "total",
          titulo: "El total de la planilla no coincide con la suma de los meses",
          detalle: `La columna de totales dice ${Math.round(total).toLocaleString("es-AR")} y la suma de todos los meses da ${Math.round(suma).toLocaleString("es-AR")}. Puede que la fórmula del total no incluya los últimos meses. Este módulo usa la suma de los meses.`,
          inversor: null,
          unidad: null,
          fila: nroFila,
          monto: suma - total,
          moneda: "ARS",
        });
      }
      return;
    }
    if (!tipoTexto) return;

    const tipo = tipoDe(tipoTexto);
    const bnTexto = normalizar(fila[c.bn]?.valor);
    const bn: BlancoNegro | null = bnTexto === "blanco" ? "blanco" : bnTexto === "negro" ? "negro" : null;
    const monTexto = normalizar(fila[c.moneda]?.valor).toUpperCase();
    // Los anticipos van en la columna "ANTICIPO USD": son en dólares aunque la fila diga otra cosa.
    const moneda: Moneda | null = tipo?.tipo === "anticipo" ? "USD" : monTexto === "ARS" || monTexto === "USD" ? monTexto : null;
    const base = { inversor: inversor || null, unidad: unidad || null, fila: nroFila };
    if (tipo?.tipo === "anticipo" && monTexto !== "USD" && typeof fila[c.anticipo]?.valor === "number") {
      avisos.push({
        ...base,
        tipo: "dato-raro",
        titulo: "Anticipo con otra moneda en la columna MONEDA",
        detalle: `La fila dice "${texto(fila[c.moneda]) || "(vacío)"}". Se cuenta en dólares, porque está en la columna ANTICIPO USD.`,
        monto: fila[c.anticipo].valor as number,
        moneda: "USD",
      });
    }

    if (!tipo || !bn || !moneda) {
      const falta = [!tipo && `tipo de pago "${tipoTexto}" desconocido`, !bn && "sin blanco/negro", !moneda && "sin moneda"].filter(Boolean).join(", ");
      avisos.push({ ...base, tipo: "fila-incompleta", titulo: "Fila que no se pudo leer", detalle: `${falta}. No se cuenta.`, monto: null, moneda: null });
      return;
    }

    const celdasConMonto = meses
      .map((mes, j) => ({ mes, j, celda: fila[j] }))
      .filter((x): x is { mes: string; j: number; celda: Celda } => !!x.mes && x.celda?.valor != null && x.celda.valor !== "" && x.celda.valor !== 0);

    if (normalizar(inversor) === "falta vender") {
      const total = celdasConMonto.reduce((s, x) => s + (typeof x.celda.valor === "number" ? x.celda.valor : 0), 0);
      if (celdasConMonto.length) {
        avisos.push({
          ...base,
          tipo: "falta-vender",
          titulo: "Unidad sin vender con montos cargados",
          detalle: `${listaMeses(celdasConMonto.map((x) => x.mes))}. No se cuenta como ingreso.`,
          monto: total,
          moneda,
        });
      }
      return;
    }

    const mesBaseFila = c.base >= 0 ? mesDeFecha(fila[c.base]?.valor ?? null) : null;
    const pago = (mes: string | null, monto: number, estado: Estado, celda: string, color: Color = null): Pago => ({
      inversor,
      unidad,
      tipo: tipo.tipo,
      detalle: tipo.detalle,
      bn,
      moneda,
      mes,
      monto,
      estado,
      atrasado: estado === "a-cobrar" && mes != null && mes < mesActual,
      celda,
      color,
      mesBase: mesBaseFila,
    });

    if (tipo.tipo === "anticipo") {
      const monto = fila[c.anticipo]?.valor;
      if (typeof monto !== "number" || monto === 0) return;
      // Los anticipos están todos cobrados: entran el mes siguiente al mes base del CAC.
      const mes = mesBaseFila ? sumarMeses(mesBaseFila, 1) : null;
      pagos.push(pago(mes, monto, "cobrado", `${letra(c.anticipo)}${nroFila}`));
      if (!mes) {
        avisos.push({ ...base, tipo: "sin-mes-base", titulo: "Anticipo sin mes base CAC", detalle: "Se cuenta como cobrado, pero no se puede ubicar en un mes.", monto, moneda });
      }
      return;
    }

    // Por fila, se juntan las celdas que hay que revisar, para un solo aviso por fila y motivo.
    const revisar = new Map<TipoAviso, { meses: string[]; total: number }>();
    const anotar = (t: TipoAviso, mes: string, monto: number) => {
      const r = revisar.get(t) ?? { meses: [], total: 0 };
      r.meses.push(mes);
      r.total += monto;
      revisar.set(t, r);
    };

    for (const { mes, j, celda } of celdasConMonto) {
      const ref = `${letra(j)}${nroFila}`;
      if (typeof celda.valor !== "number") {
        anotar("dato-raro", mes, 0);
        continue;
      }
      const monto = celda.valor;
      if (celda.color === "celeste") {
        anotar("falta-vender", mes, monto);
        continue;
      }
      const estado: Estado = celda.color === "verde" ? "cobrado" : "a-cobrar";
      const p = pago(mes, monto, estado, ref, celda.color);
      pagos.push(p);
      if (celda.color === "amarillo") anotar("amarillo", mes, monto);
      else if (celda.color !== "verde" && celda.color !== "rosa") anotar("sin-color", mes, monto);
      else if (p.atrasado) anotar("atrasado", mes, monto);
    }

    const quien = `${tipo.detalle} en ${bn}`;
    for (const [t, r] of revisar) {
      const textos: Record<string, { titulo: string; detalle: string }> = {
        atrasado: {
          titulo: "Pago vencido sin cobrar",
          detalle: `${quien}: ${listaMeses(r.meses)}. Verificar si se cobró y que el monto esté actualizado por CAC a hoy.`,
        },
        amarillo: {
          titulo: "Marcado en amarillo para actualizar",
          detalle: `${quien}: ${listaMeses(r.meses)}. Se cuenta como a cobrar con el monto actual.`,
        },
        "sin-color": {
          titulo: "Monto sin color de cobrado o a cobrar",
          detalle: `${quien}: ${listaMeses(r.meses)}. Se cuenta como a cobrar.`,
        },
        "falta-vender": {
          titulo: "Celda marcada como sin vender",
          detalle: `${quien}: ${listaMeses(r.meses)}. No se cuenta como ingreso.`,
        },
        "dato-raro": {
          titulo: "Celda con texto en vez de un monto",
          detalle: `${quien}: ${listaMeses(r.meses)}. No se cuenta.`,
        },
      };
      avisos.push({ ...base, tipo: t, ...textos[t], monto: t === "dato-raro" ? null : r.total, moneda });
    }
  });

  return { pagos, avisos, mesActual };
}

// ---------- Filtros ----------

export interface Filtros {
  desde: string | null;
  hasta: string | null;
  moneda: Moneda | null;
  inversor: string | null;
  bn: BlancoNegro | null;
  tipo: TipoPago | null;
  estado: Estado | null;
}

export const SIN_FILTROS: Filtros = { desde: null, hasta: null, moneda: null, inversor: null, bn: null, tipo: null, estado: null };

const esMes = (v: string | null) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null);
const de = <T extends string>(v: string | null, validos: readonly T[]) => (validos.includes(v as T) ? (v as T) : null);

export function filtrosDeUrl(p: URLSearchParams): Filtros {
  return {
    desde: esMes(p.get("desde")),
    hasta: esMes(p.get("hasta")),
    moneda: de(p.get("moneda"), ["ARS", "USD"] as const),
    inversor: p.get("inversor") || null,
    bn: de(p.get("bn"), ["blanco", "negro"] as const),
    tipo: de(p.get("tipo"), ["anticipo", "cuota", "refuerzo"] as const),
    estado: de(p.get("estado"), ["cobrado", "a-cobrar"] as const),
  };
}

export function filtrosAUrl(f: Filtros): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  return p.toString();
}

/**
 * Los pagos que cumplen los filtros. Con un rango de fechas, los pagos sin mes quedan afuera,
 * porque no se sabe si caen adentro.
 */
export function filtrar(pagos: Pago[], f: Filtros): Pago[] {
  return pagos.filter(
    (p) =>
      (!f.desde || (p.mes != null && p.mes >= f.desde)) &&
      (!f.hasta || (p.mes != null && p.mes <= f.hasta)) &&
      (!f.moneda || p.moneda === f.moneda) &&
      (!f.inversor || p.inversor === f.inversor) &&
      (!f.bn || p.bn === f.bn) &&
      (!f.tipo || p.tipo === f.tipo) &&
      (!f.estado || p.estado === f.estado),
  );
}

// ---------- Totales ----------

export interface Totales {
  cobrado: number;
  aCobrar: number;
  /** Parte de lo a cobrar que es de meses ya pasados. */
  atrasado: number;
  total: number;
  cantidad: number;
}

const vacio = (): Totales => ({ cobrado: 0, aCobrar: 0, atrasado: 0, total: 0, cantidad: 0 });

/** Totales por moneda. Las monedas nunca se suman entre sí. */
export function totalesPorMoneda(pagos: Pago[]): Record<Moneda, Totales> {
  const r = { ARS: vacio(), USD: vacio() };
  for (const p of pagos) {
    const t = r[p.moneda];
    if (p.estado === "cobrado") t.cobrado += p.monto;
    else t.aCobrar += p.monto;
    if (p.atrasado) t.atrasado += p.monto;
    t.total += p.monto;
    t.cantidad++;
  }
  return r;
}

export interface MesFlujo {
  mes: string;
  blanco: number;
  negro: number;
  total: number;
  cobrado: number;
  aCobrar: number;
  /** Suma desde el primer mes del rango hasta este. */
  acumulado: number;
}

/** Lo de una moneda, mes por mes y sin huecos, del primer al último mes (o del rango pedido). */
export function porMes(pagos: Pago[], moneda: Moneda, desde?: string | null, hasta?: string | null): MesFlujo[] {
  const conMes = pagos.filter((p) => p.moneda === moneda && p.mes);
  if (!conMes.length) return [];
  const meses = conMes.map((p) => p.mes!).sort();
  const inicio = desde ?? meses[0];
  const fin = hasta ?? meses.at(-1)!;
  const r: MesFlujo[] = [];
  for (let m = inicio, acumulado = 0; m <= fin; m = sumarMeses(m, 1)) {
    const delMes = conMes.filter((p) => p.mes === m);
    const suma = (f: (p: Pago) => boolean) => delMes.filter(f).reduce((s, p) => s + p.monto, 0);
    const total = suma(() => true);
    acumulado += total;
    r.push({
      mes: m,
      blanco: suma((p) => p.bn === "blanco"),
      negro: suma((p) => p.bn === "negro"),
      total,
      cobrado: suma((p) => p.estado === "cobrado"),
      aCobrar: suma((p) => p.estado === "a-cobrar"),
      acumulado,
    });
  }
  return r;
}

export interface FilaInversor {
  inversor: string;
  unidades: string[];
  totales: Record<Moneda, Totales>;
  /** El próximo pago a cobrar desde este mes en adelante. */
  proximo: { mes: string; monto: number; moneda: Moneda } | null;
  atrasados: number;
}

export function porInversor(pagos: Pago[], mesActual: string): FilaInversor[] {
  const grupos = new Map<string, Pago[]>();
  for (const p of pagos) grupos.set(p.inversor, [...(grupos.get(p.inversor) ?? []), p]);
  return [...grupos]
    .map(([inversor, ps]) => {
      const futuros = ps.filter((p) => p.estado === "a-cobrar" && p.mes && p.mes >= mesActual).sort((a, b) => a.mes!.localeCompare(b.mes!));
      const primero = futuros[0];
      return {
        inversor,
        unidades: [...new Set(ps.map((p) => p.unidad).filter(Boolean))],
        totales: totalesPorMoneda(ps),
        proximo: primero
          ? {
              mes: primero.mes!,
              moneda: primero.moneda,
              monto: futuros.filter((p) => p.mes === primero.mes && p.moneda === primero.moneda).reduce((s, p) => s + p.monto, 0),
            }
          : null,
        atrasados: ps.filter((p) => p.atrasado).length,
      };
    })
    .sort((a, b) => a.inversor.localeCompare(b.inversor, "es"));
}

/** Los pagos en CSV para Excel en español: separador ";", coma decimal y BOM para los acentos. */
export function aCsv(pagos: Pago[]): string {
  const celda = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const filas = [
    ["Mes", "Inversor", "Unidad", "Tipo", "Blanco/Negro", "Moneda", "Monto", "Estado", "Atrasado", "Celda"],
    ...pagos.map((p) => [
      p.mes ?? "",
      p.inversor,
      p.unidad,
      p.detalle,
      p.bn === "blanco" ? "Blanco" : "Negro",
      p.moneda,
      p.monto.toFixed(2).replace(".", ","),
      p.estado === "cobrado" ? "Cobrado" : "A cobrar",
      p.atrasado ? "Sí" : "",
      p.celda,
    ]),
  ];
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
}
