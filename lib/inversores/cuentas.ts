/**
 * Cuentas corrientes de los inversores de Lerma.
 *
 * Sale de dos pestañas:
 * - "Pagos por Inversor": un bloque por inversor, uno al lado del otro (ficha, costo estimado del
 *   departamento, monto formal e informal, lista de pagos, notas y comentarios).
 * - "Flujo de fondos LERMA" (ver lib/finanzas/ingresos.ts): los pagos que faltan, por mes.
 *
 * Se unen por unidad funcional y nombre. Ver docs/inversores-cuentas.md.
 * Todo lo de acá es puro (sin red): lo usan la ruta de la API, las pantallas y los tests.
 */

import { diaDeFecha } from "../finanzas/egresos";
import { mesDeFecha, type Celda, type FlujoIngresos, type Moneda, type Pago } from "../finanzas/ingresos";

export interface Movimiento {
  /** "2026-04-22". Null si la fecha no se pudo leer. */
  fecha: string | null;
  /** Como figura en la planilla, si la fecha no se pudo leer o es imposible. */
  fechaTexto: string;
  monto: number;
  moneda: Moneda;
  /** true formal, false informal, null sin dato. */
  formal: boolean | null;
  tipoCambio: number | null;
  /** El equivalente en dólares al tipo de cambio del día del pago. */
  usd: number | null;
  numero: string;
  concepto: string;
  /** Fila de la planilla (desde 1). */
  fila: number;
}

export interface Cuenta {
  /** Para la URL: "4d-alon-druck". */
  id: string;
  inversor: string;
  unidad: string;
  emprendimiento: string;
  cuit: string;
  telefono: string;
  mesBaseCac: string | null;
  /** Costo estimado del departamento (el precio pactado), en dólares y en pesos. */
  precioUsd: number | null;
  precioArs: number | null;
  formalUsd: number | null;
  informalUsd: number | null;
  pagos: Movimiento[];
  /** Notas para el inversor (las del final del bloque), para el estado de cuenta impreso. */
  notas: string[];
  /** Comentarios internos del bloque. */
  comentarios: string[];
  /** Lo que falta pagar según el Flujo de fondos (rosa o amarillo), por mes. */
  pendientes: Pago[];
  /** Lo marcado como cobrado en el Flujo. */
  cobradoFlujo: Pago[];
  /** "planilla": tiene bloque en "Pagos por Inversor". "flujo": solo aparece en el Flujo. */
  origen: "planilla" | "flujo";
  /** Columna donde empieza el bloque ("L"), para ir a buscarlo. */
  columna: string | null;
  avisos: AvisoCuenta[];
  /**
   * Bloque con el encabezado roto (la unidad dice #REF!, NINGUNO o nada): no se sabe de quién es.
   * Si sus pagos coinciden con los de alguien del Flujo, se une a esa cuenta (ver unirConFlujo).
   */
  sinUnidad?: boolean;
}

export type TipoAvisoCuenta = "fecha" | "sin-usd" | "sin-tipo" | "solo-flujo" | "mas-del-100" | "encabezado" | "cruce" | "completado";

export interface AvisoCuenta {
  tipo: TipoAvisoCuenta;
  titulo: string;
  detalle: string;
  filas: number[];
}

export interface CuentasCorrientes {
  cuentas: Cuenta[];
  /** Avisos que no son de una cuenta (filas del Flujo que no se pudieron asignar). */
  avisos: (AvisoCuenta & { inversor: string; unidad: string })[];
  mesActual: string;
}

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function letra(i: number): string {
  return i < 26 ? LETRAS[i] : letra(Math.floor(i / 26) - 1) + LETRAS[i % 26];
}

function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[?¿:]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function texto(c: Celda | undefined): string {
  return c?.valor == null ? "" : String(c.valor).trim();
}

const numero = (c: Celda | undefined) => (typeof c?.valor === "number" ? c.valor : null);

export function slug(...partes: string[]): string {
  return normalizar(partes.join(" "))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Unidades que no son un departamento: el bloque se ignora (inversores retirados o bloques rotos). */
const UNIDAD_INVALIDA = /^(#|ninguno$|-$|$)/i;

/** Una fecha posible para un pago ya hecho: desde 2020 y hasta el mes actual (no puede ser futura). */
function fechaPosible(fecha: string, mesActual: string): boolean {
  return Number(fecha.slice(0, 4)) >= 2020 && fecha.slice(0, 7) <= mesActual;
}

/**
 * Lee "Pagos por Inversor". Cada bloque empieza en la fila 2 con "Estado de cuenta al…"; dentro,
 * las etiquetas ("Inversor", "Costo Estimado Departamento", "Operación"…) dicen dónde está cada dato.
 */
export function leerBloques(filas: Celda[][], mesActual: string): Omit<Cuenta, "pendientes" | "cobradoFlujo">[] {
  const fila2 = filas[1] ?? [];
  const inicios = fila2.map((c, i) => (normalizar(c.valor).startsWith("estado de cuenta") ? i : -1)).filter((i) => i >= 0);
  const cuentas: Omit<Cuenta, "pendientes" | "cobradoFlujo">[] = [];

  inicios.forEach((inicio, n) => {
    const fin = inicios[n + 1] ?? inicio + 12;
    const celda = (r: number, c: number) => (c < fin ? filas[r]?.[c] : undefined);
    /** La primera celda del bloque con esa etiqueta (normalizada, por comienzo). */
    const buscar = (...etiquetas: string[]): [number, number] | null => {
      for (let r = 2; r < Math.min(filas.length, 60); r++) {
        for (let c = inicio; c < fin; c++) {
          const t = normalizar(filas[r]?.[c]?.valor);
          if (t && etiquetas.some((e) => t.startsWith(e))) return [r, c];
        }
      }
      return null;
    };

    const ficha = buscar("inversor");
    if (!ficha) return;
    const [rf, cf] = ficha;
    const datoFicha = (etiqueta: string) => {
      for (let c = cf; c < fin; c++) if (normalizar(celda(rf, c)?.valor).startsWith(etiqueta)) return celda(rf + 1, c);
      return undefined;
    };
    const unidad = texto(datoFicha("departamento"));
    const inversor = texto(datoFicha("inversor"));
    if (!inversor) return;
    // Con la unidad rota se lee igual: puede ser un bloque copiado de otro con los pagos de alguien más.
    const sinUnidad = UNIDAD_INVALIDA.test(unidad);

    const montos = (...etiquetas: string[]) => {
      const p = buscar(...etiquetas);
      return p ? { usd: numero(celda(p[0], p[1] + 1)), ars: numero(celda(p[0], p[1] + 2)) } : { usd: null, ars: null };
    };
    const precio = montos("costo estimado dep");
    const formal = montos("monto total formal", "monto total en blanco", "monto total en formal");
    const informal = montos("monto total informal", "monto total en negro", "monto total en informal");

    const pagos: Movimiento[] = [];
    const notas: string[] = [];
    const comentarios: string[] = [];
    const encabezado = buscar("operacion");
    if (encabezado) {
      const [rh] = encabezado;
      const col: Record<string, number> = {};
      // Algunos bloques tienen al lado una plantilla vacía con los mismos títulos: vale la primera.
      for (let c = encabezado[1]; c < fin; c++) {
        const t = normalizar(celda(rh, c)?.valor);
        if (c > encabezado[1] && t === "operacion") break;
        if (t && !(t in col)) col[t] = c;
      }
      const c = {
        fecha: encabezado[1],
        monto: col["monto"],
        moneda: col["moneda"],
        tipo: col["legalidad"] ?? col["tipo"],
        tipoCambio: col["tipo de cambio"],
        usd: col["monto en dolares"],
        numero: col["numero de concepto"],
        concepto: col["concepto"],
      };
      let modo: "pagos" | "notas" | "comentarios" = "pagos";
      let vacias = 0;
      for (let r = rh + 1; r < filas.length; r++) {
        const primera = texto(celda(r, inicio));
        const n = normalizar(primera);
        if (n.startsWith("notas")) {
          modo = "notas";
          continue;
        }
        if (n.startsWith("comentarios")) {
          modo = "comentarios";
          const resto = primera.replace(/^comentarios\s*:?\s*/i, "");
          if (resto) comentarios.push(resto);
          continue;
        }
        if (modo !== "pagos") {
          if (!primera) {
            if (++vacias > 8) break;
            continue;
          }
          vacias = 0;
          (modo === "notas" ? notas : comentarios).push(primera);
          continue;
        }
        const monto = numero(celda(r, c.monto));
        if (monto == null || monto === 0) {
          // Filas de relleno ("-") o vacías entre los pagos y las notas.
          if (!primera && texto(celda(r, c.monto)) === "" && ++vacias > 8) break;
          continue;
        }
        vacias = 0;
        const monedaTexto = normalizar(celda(r, c.moneda)?.valor);
        const moneda: Moneda = monedaTexto.startsWith("dol") || monedaTexto === "usd" ? "USD" : "ARS";
        const tipo = normalizar(celda(r, c.tipo)?.valor);
        const tipoCambio = numero(celda(r, c.tipoCambio));
        const fechaCelda = celda(r, c.fecha)?.valor ?? null;
        let fecha = diaDeFecha(fechaCelda);
        if (fecha && !fechaPosible(fecha, mesActual)) fecha = null;
        const usdPlanilla = numero(celda(r, c.usd));
        pagos.push({
          fecha,
          fechaTexto: fecha ? "" : typeof fechaCelda === "number" ? (diaDeFecha(fechaCelda) ?? String(fechaCelda)) : String(fechaCelda ?? ""),
          monto,
          moneda,
          formal: tipo === "formal" || tipo === "blanco" ? true : tipo === "informal" || tipo === "negro" ? false : null,
          tipoCambio,
          usd: usdPlanilla ?? (moneda === "USD" ? monto : tipoCambio ? monto / tipoCambio : null),
          numero: texto(celda(r, c.numero)).replace(/^-$/, ""),
          concepto: texto(celda(r, c.concepto)).replace(/^-$/, ""),
          fila: r + 1,
        });
      }
    }
    pagos.sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999") || a.fila - b.fila);

    const avisos: AvisoCuenta[] = [];
    const conFechaRara = pagos.filter((p) => !p.fecha);
    if (conFechaRara.length) {
      avisos.push({
        tipo: "fecha",
        titulo: "Pagos con una fecha imposible, futura o mal escrita",
        detalle: `${conFechaRara.map((p) => `"${p.fechaTexto || "(vacía)"}" (${p.concepto || "sin concepto"})`).join(", ")}. Se cuentan, pero no se ubican en el tiempo.`,
        filas: conFechaRara.map((p) => p.fila),
      });
    }
    const sinUsd = pagos.filter((p) => p.usd == null);
    if (sinUsd.length) {
      avisos.push({ tipo: "sin-usd", titulo: "Pagos sin equivalente en dólares", detalle: "Falta el tipo de cambio: no suman al avance en dólares.", filas: sinUsd.map((p) => p.fila) });
    }
    const sinTipo = pagos.filter((p) => p.formal == null);
    if (sinTipo.length) {
      avisos.push({ tipo: "sin-tipo", titulo: "Pagos sin formal o informal", detalle: "Suman al total, pero no al avance formal ni al informal.", filas: sinTipo.map((p) => p.fila) });
    }

    cuentas.push({
      id: slug(unidad, inversor),
      inversor,
      unidad,
      emprendimiento: texto(datoFicha("emprendimiento")),
      cuit: texto(datoFicha("cuit")).replace(/^#.*/, ""),
      telefono: texto(datoFicha("numero")),
      mesBaseCac: mesDeFecha(datoFicha("mes base")?.valor ?? null),
      precioUsd: precio.usd,
      precioArs: precio.ars,
      formalUsd: formal.usd,
      informalUsd: informal.usd,
      pagos,
      notas,
      comentarios,
      origen: "planilla",
      columna: letra(inicio),
      avisos,
      ...(sinUnidad ? { sinUnidad: true } : {}),
    });
  });
  return cuentas;
}

// ---------- Unión con el Flujo de fondos ----------

const palabras = (s: string) => normalizar(s).split(/[^a-z0-9]+/).filter((p) => p.length > 2);

/** Distancia de edición, para nombres con una letra distinta ("Iony" y "Ioni"). */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Cuántas palabras de un nombre aparecen en el otro (con una letra de diferencia, si son largas). */
export function parecido(a: string, b: string): number {
  const pb = palabras(b);
  return palabras(a).filter((x) => pb.some((y) => x === y || (x.length > 3 && y.length > 3 && distancia(x, y) <= 1))).length;
}

/**
 * Une las cuentas de "Pagos por Inversor" con las filas del Flujo:
 * 1. Misma unidad y nombre parecido (la que más se parezca).
 * 2. Misma unidad, si hay una sola cuenta en esa unidad y nadie del Flujo en esa unidad se llama como ella.
 * 3. Otra unidad, mismo nombre (un inversor con dos unidades).
 * Lo que no se puede unir arma una cuenta solo con el Flujo.
 */
export function unirConFlujo(bloques: Omit<Cuenta, "pendientes" | "cobradoFlujo">[], flujo: FlujoIngresos): CuentasCorrientes {
  const cuentas: Cuenta[] = bloques.filter((b) => !b.sinUnidad).map((b) => ({ ...b, pendientes: [], cobradoFlujo: [] }));
  const sinUnidad = bloques.filter((b) => b.sinUnidad && b.pagos.length);
  const porUnidad = (u: string) => cuentas.filter((c) => c.origen === "planilla" && normalizar(c.unidad) === normalizar(u));
  const nombresFlujo = new Map<string, string[]>();
  for (const p of flujo.pagos) {
    const u = normalizar(p.unidad);
    nombresFlujo.set(u, [...new Set([...(nombresFlujo.get(u) ?? []), p.inversor])]);
  }

  const elegir = (inversor: string, unidad: string): Cuenta | null => {
    const misma = porUnidad(unidad);
    const mejor = misma.map((c) => ({ c, s: parecido(inversor, c.inversor) })).sort((a, b) => b.s - a.s)[0];
    if (mejor && mejor.s > 0) return mejor.c;
    if (misma.length === 1) {
      const otros = nombresFlujo.get(normalizar(unidad)) ?? [];
      if (!otros.some((n) => parecido(n, misma[0].inversor) > 0)) return misma[0];
    }
    const otra = cuentas.filter((c) => c.origen === "planilla").map((c) => ({ c, s: parecido(inversor, c.inversor) })).sort((a, b) => b.s - a.s)[0];
    return otra && otra.s >= 2 ? otra.c : null;
  };

  const cache = new Map<string, Cuenta>();
  for (const p of flujo.pagos) {
    const clave = `${normalizar(p.unidad)}|${normalizar(p.inversor)}`;
    let cuenta = cache.get(clave) ?? elegir(p.inversor, p.unidad);
    if (!cuenta) {
      cuenta = {
        id: slug(p.unidad, p.inversor),
        inversor: p.inversor,
        unidad: p.unidad,
        emprendimiento: "",
        cuit: "",
        telefono: "",
        mesBaseCac: null,
        precioUsd: null,
        precioArs: null,
        formalUsd: null,
        informalUsd: null,
        pagos: [],
        notas: [],
        comentarios: [],
        pendientes: [],
        cobradoFlujo: [],
        origen: "flujo",
        columna: null,
        avisos: [
          {
            tipo: "solo-flujo",
            titulo: "Sin cuenta en \"Pagos por Inversor\"",
            detalle: "Aparece en el Flujo de fondos, pero no tiene bloque con sus pagos. Se muestra solo lo del Flujo.",
            filas: [],
          },
        ],
      };
      cuentas.push(cuenta);
    }
    cache.set(clave, cuenta);
    if (p.estado === "cobrado") cuenta.cobradoFlujo.push(p);
    else cuenta.pendientes.push(p);
  }

  // Bloques con el encabezado roto: si sus pagos coinciden con los cobros del Flujo de alguien que no
  // tiene bloque (al menos 3 montos iguales), son de esa persona.
  for (const b of sinUnidad) {
    const candidatas = cuentas
      .filter((c) => c.origen === "flujo")
      .map((c) => ({ c, iguales: b.pagos.filter((p) => c.cobradoFlujo.some((f) => f.moneda === p.moneda && Math.abs(f.monto - p.monto) < 1)).length }))
      .sort((x, y) => y.iguales - x.iguales);
    const mejor = candidatas[0];
    if (!mejor || mejor.iguales < 3) continue;
    const c = mejor.c;
    const precio = b.precioUsd != null ? `US$ ${Math.round(b.precioUsd).toLocaleString("es-AR")}` : "sin costo";
    Object.assign(c, {
      pagos: b.pagos,
      notas: b.notas,
      comentarios: b.comentarios,
      // Nombre, unidad, CUIT, teléfono y costo del encabezado son de otra cuenta: no se usan.
      origen: "planilla" as const,
      columna: b.columna,
      // El encabezado está copiado de otra cuenta: su costo estimado no es de esta unidad.
      precioUsd: null,
      precioArs: null,
      formalUsd: null,
      informalUsd: null,
      avisos: [
        ...b.avisos,
        {
          tipo: "encabezado" as const,
          titulo: "Encabezado copiado de otra cuenta",
          detalle: `Sus pagos están en el bloque de la columna ${b.columna} de "Pagos por Inversor" (${mejor.iguales} de ${b.pagos.length} coinciden con el Flujo), pero el encabezado dice "${b.inversor}", unidad "${b.unidad || "vacía"}" y ${precio}. Hay que corregir nombre, unidad, CUIT, teléfono y costo estimado. Mientras tanto, lo que falta se toma de otras planillas (Ventas y el Flujo), si está.`,
          filas: [],
        },
      ],
    });
  }

  for (const c of cuentas) {
    c.pendientes.sort((a, b) => (a.mes ?? "").localeCompare(b.mes ?? ""));
    const r = resumenCuenta(c, flujo.mesActual, true);
    if (c.precioUsd && r.pagadoUsd > c.precioUsd * 1.0001) {
      c.avisos.push({
        tipo: "mas-del-100",
        titulo: `Pagó más del 100% (${porcentaje(r.avance)})`,
        detalle: "Puede ser por diferencias de tipo de cambio, como dicen las notas de la planilla, o un pago mal cargado.",
        filas: [],
      });
    }
  }

  cuentas.sort((a, b) => a.unidad.localeCompare(b.unidad, "es", { numeric: true }) || a.inversor.localeCompare(b.inversor, "es"));
  return { cuentas, avisos: [], mesActual: flujo.mesActual };
}

const porcentaje = (n: number | null) => (n == null ? "—" : `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`);

// ---------- Resumen de una cuenta ----------

export interface ResumenCuenta {
  /** Precio (o monto formal, si se excluye lo informal). */
  baseUsd: number | null;
  pagadoUsd: number;
  saldoUsd: number | null;
  /** De 0 a 1 (puede pasar de 1). Null sin precio. */
  avance: number | null;
  formal: { objetivo: number | null; pagado: number; avance: number | null };
  informal: { objetivo: number | null; pagado: number; avance: number | null };
  ultimoPago: Movimiento | null;
  /** Primer pago pendiente desde este mes. */
  proximo: { mes: string; montos: { moneda: Moneda; monto: number }[] } | null;
  vencidos: Pago[];
  /** Lo que falta pagar según el Flujo, por moneda. */
  pendienteFlujo: Record<Moneda, number>;
  /** Último mes con un pago pendiente en el Flujo: cuándo termina de pagar. */
  ultimoMes: string | null;
}

/** Lo que importa de una cuenta. Con informal: false, solo cuenta lo formal (para el estado de cuenta). */
export function resumenCuenta(c: Pick<Cuenta, "precioUsd" | "formalUsd" | "informalUsd" | "pagos" | "pendientes">, mesActual: string, informal = true): ResumenCuenta {
  const pagos = informal ? c.pagos : c.pagos.filter((p) => p.formal === true);
  const pendientes = informal ? c.pendientes : c.pendientes.filter((p) => p.bn === "blanco");
  const suma = (ps: Movimiento[]) => ps.reduce((s, p) => s + (p.usd ?? 0), 0);
  const pagadoUsd = suma(pagos);
  const baseUsd = informal ? c.precioUsd : c.formalUsd;
  const pagadoFormal = suma(c.pagos.filter((p) => p.formal === true));
  const pagadoInformal = suma(c.pagos.filter((p) => p.formal === false));
  const proximos = pendientes.filter((p) => p.mes && p.mes >= mesActual);
  const mesProximo = proximos[0]?.mes ?? null;
  const montosProximo = new Map<Moneda, number>();
  for (const p of proximos.filter((p) => p.mes === mesProximo)) montosProximo.set(p.moneda, (montosProximo.get(p.moneda) ?? 0) + p.monto);
  const ultimos = pagos.filter((p) => p.fecha).sort((a, b) => a.fecha!.localeCompare(b.fecha!));
  return {
    baseUsd,
    pagadoUsd,
    saldoUsd: baseUsd == null ? null : baseUsd - pagadoUsd,
    avance: baseUsd ? pagadoUsd / baseUsd : null,
    formal: { objetivo: c.formalUsd, pagado: pagadoFormal, avance: c.formalUsd ? pagadoFormal / c.formalUsd : null },
    informal: { objetivo: c.informalUsd, pagado: pagadoInformal, avance: c.informalUsd ? pagadoInformal / c.informalUsd : null },
    ultimoPago: ultimos.at(-1) ?? null,
    proximo: mesProximo ? { mes: mesProximo, montos: [...montosProximo].map(([moneda, monto]) => ({ moneda, monto })) } : null,
    vencidos: pendientes.filter((p) => p.atrasado),
    pendienteFlujo: {
      ARS: pendientes.filter((p) => p.moneda === "ARS").reduce((s, p) => s + p.monto, 0),
      USD: pendientes.filter((p) => p.moneda === "USD").reduce((s, p) => s + p.monto, 0),
    },
    ultimoMes: pendientes.map((p) => p.mes).filter((m): m is string => !!m).sort().at(-1) ?? null,
  };
}

/** Los pagos con el acumulado en dólares y el avance después de cada uno. */
export function conAcumulado(pagos: Movimiento[], baseUsd: number | null): (Movimiento & { acumuladoUsd: number; avance: number | null })[] {
  let acumulado = 0;
  return pagos.map((p) => {
    acumulado += p.usd ?? 0;
    return { ...p, acumuladoUsd: acumulado, avance: baseUsd ? acumulado / baseUsd : null };
  });
}

/** Totales de todas las cuentas con precio, para el encabezado del listado. */
export function totalesCuentas(cuentas: Cuenta[], mesActual: string) {
  let precio = 0;
  let pagado = 0;
  /** Lo pagado por las cuentas que tienen precio: contra eso se calcula el saldo y el avance. */
  let pagadoConPrecio = 0;
  const sinPrecio: string[] = [];
  let conVencidos = 0;
  const pendiente: Record<Moneda, number> = { ARS: 0, USD: 0 };
  for (const c of cuentas) {
    const r = resumenCuenta(c, mesActual);
    pagado += r.pagadoUsd;
    if (c.precioUsd) {
      precio += c.precioUsd;
      pagadoConPrecio += r.pagadoUsd;
    } else if (r.pagadoUsd > 0) sinPrecio.push(c.unidad);
    if (r.vencidos.length) conVencidos++;
    pendiente.ARS += r.pendienteFlujo.ARS;
    pendiente.USD += r.pendienteFlujo.USD;
  }
  return { cuentas: cuentas.length, precio, pagado, saldo: precio - pagadoConPrecio, avance: precio ? pagadoConPrecio / precio : null, sinPrecio, conVencidos, pendiente };
}
