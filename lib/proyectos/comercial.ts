/**
 * Comercial de un proyecto: unidades, superficies, lista de precios y ventas, leídas del "Excel
 * madre" del proyecto (en Lerma: "Lerma 439 - Villa Crespo - Flujo de fondos y viabilidad").
 *
 * - "Lista de precios" manda: de ahí salen las unidades, su estado, sus superficies y su precio.
 * - "Ventas" es el machete de cada venta: se usa para el precio al que se vendió y el detalle.
 * - "Superficies" tiene las superficies del proyecto (construcción y vendibles).
 *
 * Cada número lleva de dónde sale (Origen) y lo que no está confirmado va a "Supuestos". Ver
 * docs/proyectos-comercial.md. Todo lo de acá es puro (sin red).
 */

import type { Celda } from "../finanzas/ingresos";

export interface Origen {
  /** "Excel madre → Lista de precios → suma de Sup Total". */
  texto: string;
}

export type EstadoUnidad = "vendida" | "libre" | "otro";

/**
 * Cómo se vendió. Lerma es un desarrollo al costo: casi todas se venden a un costo estimado y, al
 * final de la obra, el costo real × el coeficiente de cada unidad dice si el comprador debe plata
 * o hay que devolverle (la liquidación, un módulo que viene después).
 * - "costo": al costo (puede tener un tope de aumento, ver Unidad.tope).
 * - "cerrado": precio cerrado (por ejemplo, las que pagaron todo de contado): no se ajusta.
 * - "canje": se pagó con obra (contratistas).
 */
export type Modalidad = "costo" | "cerrado" | "canje";

export const MODALIDADES: Record<Modalidad, string> = {
  costo: "Al costo",
  cerrado: "Precio cerrado",
  canje: "Canje",
};

export interface Unidad {
  /** "1A", "PB", "C1" (cochera). Es la misma unidad que usan el Flujo y "Pagos por Inversor". */
  codigo: string;
  piso: string;
  /** Para ordenar: PB = 0. */
  nivel: number;
  letra: string;
  uf: string;
  tipologia: string;
  orientacion: string;
  estado: EstadoUnidad;
  estadoTexto: string;
  inversor: string;
  esCochera: boolean;
  supCubierta: number;
  supSemicubierta: number;
  supDescubierta: number;
  /** Superficie propia completa (cubierta + semicubierta + descubierta). */
  supPropia: number;
  /** Superficie propia que se vende (las terrazas se toman a un porcentaje). */
  supVenta: number;
  supAmenities: number;
  supTotal: number;
  coeficiente: number;
  /** Valor con amenities + aumento por altura: el precio de lista vigente. */
  precioLista: number;
  /** La parte del precio de lista que es aumento por altura. */
  aumentoAltura: number;
  /** Precio de lista por m² de superficie total. */
  precioM2Lista: number | null;
  /** Si está vendida: el precio al que se vendió (de "Ventas" o, si no está, de "Pagos por Inversor"). */
  precioVenta: number | null;
  /** El mismo precio según "Pagos por Inversor" (costo estimado de la cuenta), para cruzarlo. */
  precioCuenta: number | null;
  venta: VentaMachete | null;
  /** Se pagó con un contrato de obra (un contratista): no tiene cuenta corriente. */
  contrato: boolean;
  /** Vendida, pero el dueño la revende a este precio (US$). La reventa es del dueño, no del proyecto. */
  reventa: number | null;
  /** Qué se corrigió en el hub sobre lo que dice la planilla, si se corrigió algo. */
  ajuste: string | null;
  /** Cómo se vendió (solo las vendidas): del "Tipo" del machete de Ventas o de una corrección. */
  modalidad: Modalidad | null;
  /** Al costo con tope: lo máximo que puede subir sobre el precio de venta (0,07 = 7%). */
  tope: number | null;
  fila: number;
}

/**
 * Lo que se sabe de una unidad y la planilla todavía no dice (ver Proyecto.ajustes en lib/modulos.ts).
 * No llevar nombres de inversores: alcanza con la unidad.
 */
export interface AjusteUnidad {
  codigo: string;
  /** Pisa el estado de la lista de precios. */
  estado?: "vendida" | "libre";
  contrato?: boolean;
  reventa?: number;
  modalidad?: Modalidad;
  tope?: number;
  /** Si es algo que todavía hay que verificar: va a "Supuestos" como "a confirmar". */
  aConfirmar?: boolean;
  /** Título corto para "Supuestos" cuando no cambia estado, contrato ni reventa. */
  titulo?: string;
  motivo: string;
  /** "31/10/2026": cuándo se confirmó. */
  desde: string;
}

export interface VentaMachete {
  nombre: string;
  tipo: string;
  unidad: string;
  costoEstimado: number | null;
  montoBoleto: number | null;
  blanco: number | null;
  negro: number | null;
  fila: number;
}

export interface Superficies {
  terreno: number | null;
  construccion: { cubierta: number; semicubierta: number; descubierta: number } | null;
  construibles: number | null;
  vendibles: { propios: number; comunes: number; total: number } | null;
}

export type TipoSupuesto = "confirmado" | "por-confirmar" | "conflicto";

export interface Supuesto {
  tipo: TipoSupuesto;
  titulo: string;
  detalle: string;
  /** Qué se supuso mientras tanto. */
  mientras?: string;
  origen?: string;
}

export interface Comercial {
  unidades: Unidad[];
  superficies: Superficies;
  /** Precio base por m² del piso 1 y aumento por piso, deducidos de la lista. */
  precioBaseM2: number | null;
  aumentoPorPiso: number | null;
  /** "¿A cuánto vendimos?" del machete de Ventas, si está. */
  promedioVentaPlanilla: number[];
  supuestos: Supuesto[];
}

function normalizar(t: unknown): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
const num = (c: Celda | undefined) => (typeof c?.valor === "number" ? c.valor : null);
const txt = (c: Celda | undefined) => (c?.valor == null ? "" : String(c.valor).trim());

function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** La fila de títulos: la primera que tiene todas esas palabras. */
function filaDeTitulos(filas: Celda[][], ...titulos: string[]): number {
  return filas.findIndex((f) => titulos.every((t) => f.some((c) => normalizar(c.valor) === t)));
}

/** "2AyB", "6 AyB", "Planta Baja", "1A" → código de la primera unidad ("2A", "6A", "PB", "1A"). */
export function codigoDeVentas(unidad: string): string | null {
  const n = normalizar(unidad).replace(/\s+/g, "");
  if (n.startsWith("plantabaja") || n === "pb") return "PB";
  const m = n.match(/^(\d+)([a-z])/);
  return m ? `${m[1]}${m[2].toUpperCase()}` : null;
}

/** Lee "Lista de precios": una fila por unidad (y las cocheras). */
export function leerLista(filas: Celda[][]): Unidad[] {
  return leerListaCompleta(filas).unidades;
}

/** Las unidades de la lista y cuántas filas con piso quedaron afuera (debajo de las notas). */
export function leerListaCompleta(filas: Celda[][]): { unidades: Unidad[]; afuera: { fila: number; texto: string }[] } {
  const h = filaDeTitulos(filas, "estado", "piso", "uf");
  if (h < 0) throw new Error('No se encontró la fila de títulos de la "Lista de precios" (Estado, Piso, UF).');
  const titulos = filas[h].map((c) => normalizar(c.valor));
  const col = (...nombres: string[]) => titulos.findIndex((t) => nombres.some((n) => t.startsWith(n)));
  const c = {
    inversor: col("inversor"),
    estado: col("estado"),
    piso: col("piso"),
    letra: col("letra"),
    uf: col("uf"),
    tipologia: col("tipologia"),
    orientacion: col("orientacion"),
    cubierta: col("sup. cubierta"),
    semi: col("sup. semi"),
    descubierta: col("sup. descub"),
    propia: col("sup propia ("),
    venta: col("sup propia venta"),
    coeficiente: col("coeficiente"),
    amenities: col("superficie amenities"),
    conAmenities: col("valor uf (con amenities)"),
    altura: col("aumento por altura"),
    total: col("sup total"),
    precioContado: col("precio (contado)"),
    aporte: col("aporte total estimado"),
  };
  const unidades: Unidad[] = [];
  for (let r = h + 1; r < filas.length; r++) {
    const f = filas[r];
    const estadoTexto = txt(f[c.estado]);
    const pisoTexto = txt(f[c.piso]).replace(/\.0$/, "");
    // La lista termina donde empiezan las notas (texto en la columna Estado, sin piso): lo que está
    // más abajo (por ejemplo, "Opción depto 9") son variantes, no unidades.
    if (unidades.length && estadoTexto && !pisoTexto) break;
    if (!estadoTexto || !pisoTexto) continue;
    const tipologia = txt(f[c.tipologia]);
    const esCochera = /cochera/i.test(tipologia);
    const letra = txt(f[c.letra]);
    const uf = txt(f[c.uf]).replace(/\.0$/, "");
    const piso = /^pb$/i.test(pisoTexto) ? "PB" : pisoTexto;
    const nivel = piso === "PB" ? 0 : Number(piso) || 0;
    const conAmenities = num(f[c.conAmenities]) ?? 0;
    const altura = num(f[c.altura]) ?? 0;
    const supTotal = num(f[c.total]) ?? 0;
    const precioLista = esCochera ? (num(f[c.aporte]) ?? num(f[c.precioContado]) ?? 0) : conAmenities + altura;
    const e = normalizar(estadoTexto);
    unidades.push({
      codigo: esCochera ? uf : piso === "PB" ? "PB" : `${piso}${letra}`,
      piso,
      nivel,
      letra,
      uf,
      tipologia,
      orientacion: txt(f[c.orientacion]),
      estado: e.startsWith("vendid") ? "vendida" : e.startsWith("libre") ? "libre" : "otro",
      estadoTexto,
      inversor: txt(f[c.inversor]),
      esCochera,
      supCubierta: num(f[c.cubierta]) ?? 0,
      supSemicubierta: num(f[c.semi]) ?? 0,
      supDescubierta: num(f[c.descubierta]) ?? 0,
      supPropia: num(f[c.propia]) ?? 0,
      supVenta: num(f[c.venta]) ?? 0,
      supAmenities: num(f[c.amenities]) ?? 0,
      supTotal,
      coeficiente: num(f[c.coeficiente]) ?? 0,
      precioLista,
      aumentoAltura: esCochera ? 0 : altura,
      precioM2Lista: supTotal ? precioLista / supTotal : null,
      precioVenta: null,
      precioCuenta: null,
      venta: null,
      contrato: false,
      reventa: null,
      ajuste: null,
      modalidad: null,
      tope: null,
      fila: r + 1,
    });
  }
  const afuera: { fila: number; texto: string }[] = [];
  const fin = unidades.at(-1)?.fila ?? h;
  for (let r = fin; r < filas.length; r++) {
    const f = filas[r];
    if (txt(f[c.estado]) && txt(f[c.piso]) && /^(libre|vendid)/i.test(txt(f[c.estado]))) {
      afuera.push({ fila: r + 1, texto: `${txt(f[c.piso]).replace(/\.0$/, "")}${txt(f[c.letra])} (${txt(f[c.tipologia])})` });
    }
  }
  return { unidades, afuera };
}

/** Lee el machete de "Ventas": una fila por unidad con el costo estimado (precio) y lo pagado al boleto. */
export function leerVentas(filas: Celda[][]): { ventas: VentaMachete[]; promedios: number[] } {
  const h = filaDeTitulos(filas, "unidad", "costo estimado");
  if (h < 0) return { ventas: [], promedios: [] };
  const titulos = filas[h].map((c) => normalizar(c.valor));
  const col = (n: string) => titulos.findIndex((t) => t.startsWith(n));
  const c = { nombre: col("nombre"), tipo: col("tipo"), unidad: col("unidad"), costo: col("costo estimado"), boleto: col("monto al boleto"), blanco: col("blanco"), negro: col("negro") };
  const ventas: VentaMachete[] = [];
  const promedios: number[] = [];
  for (let r = h + 1; r < filas.length; r++) {
    const f = filas[r];
    const nombre = txt(f[c.nombre]);
    if (/^total/i.test(nombre)) {
      // Debajo del total, "¿A cuánto vendimos?" con el promedio por m².
      for (let k = r + 1; k < Math.min(filas.length, r + 6); k++) {
        const i = (filas[k] ?? []).findIndex((x) => /a cuanto vendim/.test(normalizar(x.valor)));
        if (i >= 0) {
          const v = (filas[k] ?? []).slice(i + 1).map((x) => x.valor).find((v): v is number => typeof v === "number");
          if (v) promedios.push(v);
        }
      }
      break;
    }
    const unidad = txt(f[c.unidad]);
    if (!unidad) continue;
    ventas.push({ nombre, tipo: txt(f[c.tipo]), unidad, costoEstimado: num(f[c.costo]), montoBoleto: num(f[c.boleto]), blanco: num(f[c.blanco]), negro: num(f[c.negro]), fila: r + 1 });
  }
  return { ventas, promedios };
}

/** Lee "Superficies": terreno, superficies de construcción y vendibles, buscando cada fila por su título. */
export function leerSuperficies(filas: Celda[][]): Superficies {
  const fila = (prefijo: string, desde = 0) => filas.findIndex((f, i) => i >= desde && normalizar(f[1]?.valor).startsWith(prefijo));
  const valores = (r: number) => (r >= 0 ? (filas[r] ?? []).map((c) => (typeof c.valor === "number" ? c.valor : null)) : []);
  const terrenoFila = fila("superficie total");
  const terreno = valores(terrenoFila).find((v) => v != null) ?? null;
  // La tabla de construcción: la fila "TOTALES" (cubierta, semicubierta, descubierta en E, F, G).
  const totales = fila("totales");
  const t = valores(totales);
  const construccion = totales >= 0 && t[4] != null ? { cubierta: t[4]!, semicubierta: t[5] ?? 0, descubierta: t[6] ?? 0 } : null;
  const alTotal = fila("construibles al");
  const construibles = valores(alTotal).find((v) => v != null) ?? null;
  // La tabla de vendibles: la fila "TOTAL CONSTRUIBLE" después del título "VENDIBLES".
  const v = valores(fila("total construibl", Math.max(0, fila("vendibles"))));
  const vendibles = v[7] != null ? { propios: v[7]!, comunes: v[8] ?? 0, total: v[9] ?? v[7]! + (v[8] ?? 0) } : null;
  return { terreno, construccion, construibles, vendibles };
}

export interface CuentaParaCruce {
  unidad: string;
  inversor: string;
  precioUsd: number | null;
}

/**
 * Arma el comercial: une la lista con el machete de ventas (y, si están, las cuentas corrientes),
 * deduce el precio base y el aumento por piso, y junta los supuestos y conflictos.
 */
export function armarComercial(
  lista: Celda[][],
  ventasFilas: Celda[][],
  superficiesFilas: Celda[][],
  cuentas: CuentaParaCruce[] | null,
  ajustes: AjusteUnidad[] = [],
): Comercial {
  const { unidades, afuera } = leerListaCompleta(lista);
  const { ventas, promedios } = leerVentas(ventasFilas);
  const superficies = leerSuperficies(superficiesFilas);
  const supuestos: Supuesto[] = [];
  const corregidos: Supuesto[] = [];

  // Lo que se sabe y la planilla todavía no dice: se aplica antes de cruzar nada.
  for (const a of ajustes) {
    const u = unidades.find((x) => x.codigo === a.codigo);
    if (!u) continue;
    const antes = u.estadoTexto;
    const cambia = a.estado && a.estado !== u.estado;
    if (a.estado) u.estado = a.estado;
    if (a.estado === "libre") u.inversor = "";
    if (a.contrato) u.contrato = true;
    if (a.reventa) u.reventa = a.reventa;
    if (a.modalidad) u.modalidad = a.modalidad;
    if (a.tope != null) u.tope = a.tope;
    u.ajuste = a.motivo;
    const que = [a.estado === "libre" ? "libre" : a.estado === "vendida" ? "vendida" : null, a.contrato ? "pagada con contrato" : null, a.reventa ? "en reventa" : null].filter(Boolean).join(", ");
    corregidos.push({
      tipo: a.aConfirmar ? "por-confirmar" : "confirmado",
      titulo: `${u.codigo}: ${[que, a.titulo].filter(Boolean).join(" · ") || "corrección"}`,
      detalle: `${a.motivo}${cambia ? ` La lista de precios dice "${antes}": conviene corregirla también en la planilla.` : ""}`,
      origen: `${a.aConfirmar ? "Dicho" : "Confirmado"} el ${a.desde}. Corrección cargada en el hub (lib/modulos.ts), no en la planilla.`,
    });
  }
  const deptos = unidades.filter((u) => !u.esCochera);

  // Precio base y aumento por piso, de la lista misma: (precio − aumento) ÷ (m² de venta + amenities),
  // y aumento ÷ (precio sin aumento × pisos por encima del primero).
  const base = mediana(deptos.filter((u) => u.supVenta + u.supAmenities > 0).map((u) => (u.precioLista - u.aumentoAltura) / (u.supVenta + u.supAmenities)));
  const aumentoPorPiso = mediana(
    deptos.filter((u) => u.nivel > 1 && u.aumentoAltura > 0).map((u) => u.aumentoAltura / ((u.precioLista - u.aumentoAltura) * (u.nivel - 1))),
  );

  // Machete de ventas: precio al que se vendió cada unidad vendida.
  const porCodigo = new Map<string, VentaMachete>();
  for (const v of ventas) {
    const cod = codigoDeVentas(v.unidad);
    // "Falta vender" no es una venta: no es el machete de nadie.
    if (cod && !/falta vender/i.test(v.nombre)) porCodigo.set(cod, v);
  }
  for (const u of unidades) {
    const v = porCodigo.get(u.codigo);
    if (u.estado === "vendida" && v) {
      u.venta = v;
      u.precioVenta = v.costoEstimado;
    }
  }
  const cuentasPorUnidad = new Map<string, CuentaParaCruce[]>();
  for (const c of cuentas ?? []) cuentasPorUnidad.set(c.unidad.toUpperCase(), [...(cuentasPorUnidad.get(c.unidad.toUpperCase()) ?? []), c]);
  for (const u of unidades) {
    if (u.estado !== "vendida") continue;
    // Una unidad puede tener varias cuentas (4D: tres titulares): se suman.
    const c = cuentasPorUnidad.get(u.codigo);
    u.precioCuenta = c?.length ? c.reduce((s, x) => s + (x.precioUsd ?? 0), 0) || null : null;
    u.precioVenta ??= u.precioCuenta;
  }

  // Cómo se vendió cada una: lo que diga una corrección y, si no, el "Tipo" del machete de Ventas.
  const contado: string[] = [];
  for (const u of unidades) {
    if (u.estado !== "vendida") {
      u.modalidad = null;
      continue;
    }
    if (u.modalidad) continue;
    const t = normalizar(u.venta?.tipo);
    if (/contado/.test(t)) {
      u.modalidad = "cerrado";
      contado.push(u.codigo);
    } else if (/canje/.test(t) || u.contrato) u.modalidad = "canje";
    else if (/costo/.test(t)) u.modalidad = "costo";
  }

  // Supuestos confirmados.
  supuestos.push({
    tipo: "confirmado",
    titulo: "La lista de precios manda",
    detalle: `El estado de cada unidad (vendida o libre) sale de la "Lista de precios"${corregidos.length ? ", salvo las correcciones de abajo" : ""}. "Ventas" se usa solo para el detalle de cada venta.`,
    origen: "Confirmado el 31/10/2026.",
  });
  if (base) {
    supuestos.push({
      tipo: "confirmado",
      titulo: `Precio vigente: US$ ${Math.round(base).toLocaleString("es-AR")}/m² en el piso 1`,
      detalle: `Más ${aumentoPorPiso ? (aumentoPorPiso * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 }) : "—"}% por cada piso de altura.`,
      origen: 'Excel madre → "Lista de precios": valor con amenities ÷ (m² de venta + amenities) y "Aumento por altura". En la planilla viene de EE.RR (M56 y J77).',
    });
  }

  supuestos.push(...corregidos);

  const vendidas = unidades.filter((u) => u.estado === "vendida" && !u.esCochera);
  if (vendidas.length) {
    const cuantas = (m: Modalidad) => vendidas.filter((u) => u.modalidad === m);
    const lista = (m: Modalidad) => cuantas(m).map((u) => u.codigo + (u.tope != null ? ` (tope ${(u.tope * 100).toLocaleString("es-AR")}%)` : "")).join(", ");
    const sinDato = vendidas.filter((u) => !u.modalidad).map((u) => u.codigo);
    supuestos.push({
      tipo: "confirmado",
      titulo: "Desarrollo al costo: al final se liquida",
      detalle: `Casi todas se vendieron a un costo estimado. Al terminar la obra, el costo real × el coeficiente de cada unidad dice si el comprador tiene que poner la diferencia o hay que devolverle. Las de precio cerrado no se ajustan. Al costo: ${cuantas("costo").length}; precio cerrado: ${lista("cerrado") || "ninguna"}; canje: ${lista("canje") || "ninguna"}.${sinDato.length ? ` Sin dato: ${sinDato.join(", ")}.` : ""}`,
      mientras: "La liquidación final es un módulo que viene después: necesita cada gasto de la obra, en pesos y en dólares.",
      origen: 'Confirmado el 31/10/2026. La modalidad sale del "Tipo" del machete de Ventas (Costo, Contado, Canjeado) y de las correcciones.',
    });
    if (contado.length) {
      supuestos.push({
        tipo: "por-confirmar",
        titulo: `"Contado" se toma como precio cerrado: ${contado.join(", ")}`,
        detalle: `En "Ventas" figuran como "Contado". Las que pagaron todo de contado se vendieron a precio cerrado, así que ${contado.length === 1 ? "esa unidad no se ajusta" : "esas unidades no se ajustan"} en la liquidación. Confirmar que sea así en todas.`,
        origen: 'Excel madre → "Ventas" → columna "Tipo".',
      });
    }
    supuestos.push({
      tipo: "por-confirmar",
      titulo: "El coeficiente supone que se venden todas las unidades",
      detalle: "El coeficiente de cada unidad (su parte del costo de la obra) está calculado como si se vendieran todas. Pero hay unidades que se van a quedar los desarrolladores: el coeficiente de las vendidas debería ser mayor. Revisarlo antes de la liquidación.",
      mientras: "Se usa el coeficiente de la lista de precios tal como está.",
      origen: 'Excel madre → "Lista de precios" → columna "Coeficiente". Dicho el 31/10/2026.',
    });
  }

  if (afuera.length) {
    supuestos.push({
      tipo: "por-confirmar",
      titulo: "Unidades debajo de la lista que no se cuentan",
      detalle: `${afuera.map((a) => a.texto).join(", ")}: están debajo de las notas (por ejemplo, "Opción depto 9"). Se toman como variantes en estudio, no como unidades.`,
      origen: `Lista de precios, ${afuera.map((a) => `fila ${a.fila}`).join(", ")}`,
    });
  }

  // Conflictos entre la lista y el machete de ventas o las cuentas.
  for (const u of deptos) {
    const v = porCodigo.get(u.codigo);
    // Si una corrección ya explica la unidad (una venta caída o un cambio de unidad), el machete viejo no es conflicto.
    if (u.estado === "libre" && v && v.nombre && !u.ajuste) {
      supuestos.push({
        tipo: "conflicto",
        titulo: `${u.codigo}: libre en la lista, con venta en el machete`,
        detalle: `En "Ventas" figura "${v.nombre}"${v.tipo ? ` (${v.tipo})` : ""}. Se toma como libre, porque manda la lista.`,
        origen: `Lista de precios fila ${u.fila} · Ventas fila ${v.fila}`,
      });
    }
    if (u.estado === "libre" && u.inversor) {
      supuestos.push({
        tipo: "conflicto",
        titulo: `${u.codigo}: libre en la lista, pero con inversor`,
        detalle: `La lista dice "Libre" y en la columna Inversor dice "${u.inversor}". ¿Es un canje o una reserva?`,
        origen: `Lista de precios fila ${u.fila}`,
      });
    }
    if (cuentas && u.estado === "vendida" && !u.contrato && !cuentasPorUnidad.has(u.codigo)) {
      supuestos.push({
        tipo: "conflicto",
        titulo: `${u.codigo}: vendida, sin cuenta corriente`,
        detalle: `La lista la tiene vendida a "${u.inversor}", pero no está en "Pagos por Inversor" ni en el Flujo de fondos.`,
        origen: `Lista de precios fila ${u.fila}`,
      });
    }
    if (cuentas && u.estado === "libre" && cuentasPorUnidad.has(u.codigo)) {
      const c = cuentasPorUnidad.get(u.codigo)!;
      supuestos.push({
        tipo: "conflicto",
        titulo: `${u.codigo}: libre en la lista, con cuenta corriente`,
        detalle: `Tiene cuenta a nombre de ${c.map((x) => x.inversor).join(", ")}.`,
        origen: `Lista de precios fila ${u.fila} · Cuentas corrientes`,
      });
    }
    if (u.estado === "vendida" && !u.ajuste && u.venta?.costoEstimado != null && u.precioCuenta != null && Math.abs(u.venta.costoEstimado - u.precioCuenta) > Math.max(1, u.precioCuenta * 0.005)) {
      supuestos.push({
        tipo: "conflicto",
        titulo: `${u.codigo}: el precio de venta no coincide`,
        detalle: `En "Ventas" dice US$ ${Math.round(u.venta.costoEstimado).toLocaleString("es-AR")} y en "Pagos por Inversor" (costo estimado de la cuenta) US$ ${Math.round(u.precioCuenta).toLocaleString("es-AR")}. Se usa el de "Ventas".`,
        origen: `Ventas fila ${u.venta.fila} · Pagos por Inversor`,
      });
    }
    if (u.estado === "vendida" && u.precioVenta == null) {
      supuestos.push({
        tipo: "por-confirmar",
        titulo: `${u.codigo}: vendida sin precio de venta`,
        detalle: "No está en el machete de \"Ventas\" ni tiene costo estimado en su cuenta: no suma al precio promedio de venta.",
        origen: `Lista de precios fila ${u.fila}`,
      });
    }
  }

  return { unidades, superficies, precioBaseM2: base, aumentoPorPiso, promedioVentaPlanilla: promedios, supuestos };
}

// ---------- Resumen y simulación ----------

export interface ResumenComercial {
  deptos: number;
  vendidas: number;
  libres: number;
  cocheras: { total: number; vendidas: number };
  m2: { total: number; vendidos: number; libres: number };
  /** Las vendidas según cómo se vendieron (deptos). */
  modalidades: Record<Modalidad, number>;
  /** Vendidas que el dueño revende: cuentan como vendidas (la reventa no es del proyecto). */
  enReventa: { cantidad: number; total: number };
  vendido: { total: number; m2ConPrecio: number; promedioM2: number | null };
  /** Lo que falta vender, a precio de lista vigente. */
  porVender: number;
}

export function resumen(u: Unidad[]): ResumenComercial {
  const deptos = u.filter((x) => !x.esCochera);
  const vendidas = deptos.filter((x) => x.estado === "vendida");
  const libres = deptos.filter((x) => x.estado === "libre");
  const conPrecio = vendidas.filter((x) => x.precioVenta != null);
  const suma = (xs: Unidad[], f: (x: Unidad) => number) => xs.reduce((s, x) => s + f(x), 0);
  const total = suma(conPrecio, (x) => x.precioVenta!);
  const m2ConPrecio = suma(conPrecio, (x) => x.supTotal);
  const cocheras = u.filter((x) => x.esCochera);
  return {
    deptos: deptos.length,
    vendidas: vendidas.length,
    libres: libres.length,
    cocheras: { total: cocheras.length, vendidas: cocheras.filter((x) => x.estado === "vendida").length },
    m2: { total: suma(deptos, (x) => x.supTotal), vendidos: suma(vendidas, (x) => x.supTotal), libres: suma(libres, (x) => x.supTotal) },
    modalidades: { costo: vendidas.filter((x) => x.modalidad === "costo").length, cerrado: vendidas.filter((x) => x.modalidad === "cerrado").length, canje: vendidas.filter((x) => x.modalidad === "canje").length },
    enReventa: { cantidad: vendidas.filter((x) => x.reventa).length, total: suma(vendidas, (x) => x.reventa ?? 0) },
    vendido: { total, m2ConPrecio, promedioM2: m2ConPrecio ? total / m2ConPrecio : null },
    porVender: suma(libres, (x) => x.precioLista) + suma(cocheras.filter((x) => x.estado === "libre"), (x) => x.precioLista),
  };
}

/** El precio de lista de una unidad con otro precio base por m² y otro aumento por piso. */
export function precioSimulado(u: Unidad, base: number, aumentoPorPiso: number): number {
  if (u.esCochera) return u.precioLista;
  const m2 = u.supVenta + u.supAmenities;
  return m2 * base * (1 + Math.max(0, u.nivel - 1) * aumentoPorPiso);
}
