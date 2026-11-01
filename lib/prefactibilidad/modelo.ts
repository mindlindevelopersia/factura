/**
 * Prefactibilidad: el análisis de un lote antes (y después) de comprarlo. Lote y normativa,
 * superficies construibles por piso (con el castigo de cada descubierta a mano) y superficies
 * vendibles por unidad (teóricas y reales).
 *
 * Se arma en HQ y, cuando el lote se compra, se asigna a un proyecto: es la misma (se edita desde
 * los dos lados). Las versiones guardan cómo estaba en cada momento. Todo puro (sin red).
 */

import { limpiarPlusvalia, PLUSVALIA_VACIA, type DatosPlusvalia } from "./plusvalia";

export interface Descubierta {
  nombre: string;
  m2: number;
  /** Qué parte computa (0,5 = al 50%). */
  computa: number;
}

export interface PisoConstruible {
  nombre: string;
  cubierta: number;
  semicubierta: number;
  descubiertas: Descubierta[];
  /** Entra en la superficie según GCBA (el subsuelo o la sala de máquinas, por ejemplo, no). */
  computaGcba: boolean;
}

export interface UnidadVendible {
  codigo: string;
  piso: string;
  tipologia: string;
  cubierta: number;
  semicubierta: number;
  descubiertas: Descubierta[];
  /** Lo vendible en la realidad (si no se dice, lo teórico): un balcón gigante que no se cobra entero, etc. */
  real: number | null;
  nota: string;
}

export interface Terreno {
  nombre: string;
  frente: number;
  fondo: number;
}

export interface Normativa {
  distrito: string;
  tipologia: string;
  zonificacion: string;
  basamento: string;
  fot: number | null;
  fos: number | null;
  densidad: string;
  cocheraObligatoria: string;
  premio: string;
  alturaMaxima: number | null;
  pisosMaximos: number | null;
  retiros: string;
  lfi: string;
  proteccionHistorica: string;
  linkCodigo: string;
}

export interface DatosPrefactibilidad {
  direccion: string;
  ciudad: string;
  fecha: string;
  normativa: Normativa;
  terrenos: Terreno[];
  /** Superficie ocupada en planta por el proyecto (para el FOS). */
  fosProyecto: number | null;
  pisos: PisoConstruible[];
  unidades: UnidadVendible[];
  notas: string;
  plusvalia: DatosPlusvalia;
}

export const ESTADOS_PREFACTIBILIDAD = ["En análisis", "Asignada", "Descartada"] as const;
export type EstadoPrefactibilidad = (typeof ESTADOS_PREFACTIBILIDAD)[number];

export interface Prefactibilidad {
  id: string;
  nombre: string;
  estado: EstadoPrefactibilidad;
  /** El proyecto al que se asignó ("lerma-439"), o "". */
  proyecto: string;
  /** El link a la carpeta de Drive con la volumetría, el anteproyecto, los PDF y el CAD. */
  carpeta: string;
  creada: string;
  actualizada: string;
  edito: string;
  datos: DatosPrefactibilidad;
}

export interface Version {
  id: string;
  prefactibilidadId: string;
  nombre: string;
  fecha: string;
  autor: string;
  datos: DatosPrefactibilidad;
}

export const NORMATIVA_VACIA: Normativa = {
  distrito: "",
  tipologia: "",
  zonificacion: "",
  basamento: "",
  fot: null,
  fos: null,
  densidad: "",
  cocheraObligatoria: "",
  premio: "",
  alturaMaxima: null,
  pisosMaximos: null,
  retiros: "",
  lfi: "",
  proteccionHistorica: "",
  linkCodigo: "",
};

export const datosVacios = (hoy: string): DatosPrefactibilidad => ({
  direccion: "",
  ciudad: "CABA",
  fecha: hoy,
  normativa: { ...NORMATIVA_VACIA },
  terrenos: [{ nombre: "Terreno 1", frente: 0, fondo: 0 }],
  fosProyecto: null,
  pisos: [
    { nombre: "PB", cubierta: 0, semicubierta: 0, descubiertas: [], computaGcba: true },
    { nombre: "1er piso", cubierta: 0, semicubierta: 0, descubiertas: [], computaGcba: true },
  ],
  unidades: [],
  notas: "",
  plusvalia: { ...PLUSVALIA_VACIA },
});

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : 0;
};
const nn = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : n(v));
const t = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const coef = (v: unknown) => Math.min(1, n(v));
const descubiertas = (v: unknown): Descubierta[] =>
  (Array.isArray(v) ? v : []).slice(0, 20).map((d) => ({ nombre: t((d as Descubierta)?.nombre, 60), m2: n((d as Descubierta)?.m2), computa: coef((d as Descubierta)?.computa) }));

/** Limpia lo que llega del navegador (o de la planilla): números, textos y listas con límites. */
export function limpiarDatos(x: unknown, hoy: string): DatosPrefactibilidad {
  const o = (x ?? {}) as Record<string, unknown>;
  const nv = (o.normativa ?? {}) as Record<string, unknown>;
  const base = datosVacios(hoy);
  return {
    direccion: t(o.direccion),
    ciudad: t(o.ciudad, 80) || base.ciudad,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(o.fecha)) ? String(o.fecha) : hoy,
    normativa: {
      distrito: t(nv.distrito, 80),
      tipologia: t(nv.tipologia, 80),
      zonificacion: t(nv.zonificacion, 80),
      basamento: t(nv.basamento, 80),
      fot: nn(nv.fot),
      fos: nn(nv.fos),
      densidad: t(nv.densidad, 80),
      cocheraObligatoria: t(nv.cocheraObligatoria, 80),
      premio: t(nv.premio, 80),
      alturaMaxima: nn(nv.alturaMaxima),
      pisosMaximos: nn(nv.pisosMaximos),
      retiros: t(nv.retiros, 80),
      lfi: t(nv.lfi, 80),
      proteccionHistorica: t(nv.proteccionHistorica, 80),
      linkCodigo: t(nv.linkCodigo, 500),
    },
    terrenos: (Array.isArray(o.terrenos) ? o.terrenos : base.terrenos).slice(0, 10).map((x) => ({ nombre: t((x as Terreno)?.nombre, 60), frente: n((x as Terreno)?.frente), fondo: n((x as Terreno)?.fondo) })),
    fosProyecto: nn(o.fosProyecto),
    pisos: (Array.isArray(o.pisos) ? o.pisos : []).slice(0, 60).map((x) => {
      const p = x as PisoConstruible;
      return { nombre: t(p?.nombre, 40), cubierta: n(p?.cubierta), semicubierta: n(p?.semicubierta), descubiertas: descubiertas(p?.descubiertas), computaGcba: p?.computaGcba !== false };
    }),
    unidades: (Array.isArray(o.unidades) ? o.unidades : []).slice(0, 300).map((x) => {
      const u = x as UnidadVendible;
      return { codigo: t(u?.codigo, 20), piso: t(u?.piso, 40), tipologia: t(u?.tipologia, 60), cubierta: n(u?.cubierta), semicubierta: n(u?.semicubierta), descubiertas: descubiertas(u?.descubiertas), real: nn(u?.real), nota: t(u?.nota, 200) };
    }),
    notas: t(o.notas, 5000),
    plusvalia: limpiarPlusvalia(o.plusvalia),
  };
}

const suma = (l: number[]) => Math.round(l.reduce((s, x) => s + x, 0) * 100) / 100;
const descubiertaComputada = (d: Descubierta[]) => suma(d.map((x) => x.m2 * x.computa));
const descubiertaTotal = (d: Descubierta[]) => suma(d.map((x) => x.m2));

/** Lo vendible teórico de una unidad: cubierta + semicubierta + cada descubierta a su %. */
export const vendibleTeorico = (u: UnidadVendible) => suma([u.cubierta, u.semicubierta, descubiertaComputada(u.descubiertas)]);
export const vendibleReal = (u: UnidadVendible) => (u.real ?? vendibleTeorico(u));
/** Lo construible de un piso con las descubiertas a su %. */
export const construiblePiso = (p: PisoConstruible) => suma([p.cubierta, p.semicubierta, descubiertaComputada(p.descubiertas)]);

export interface Calculo {
  superficieTerreno: number;
  fosPermitido: number | null;
  /** Lo que permite el FOT: superficie del terreno × FOT. */
  capacidadFot: number | null;
  construible: {
    cubierta: number;
    semicubierta: number;
    descubierta: number;
    /** Cubierta + semicubierta de los pisos que computan (sin descubiertas): como lo cuenta el GCBA. */
    gcba: number;
    /** Con cada descubierta a su %. */
    conDescubiertas: number;
    /** Todo al 100%. */
    total: number;
  };
  vendible: {
    teorico: number;
    real: number;
    /** Construible (con descubiertas a su %) − vendible teórico. */
    comunes: number;
    /** Vendible teórico / construible (con descubiertas a su %). */
    porcentaje: number | null;
  };
  avisos: { nivel: "error" | "atencion"; texto: string }[];
}

export function calcular(d: DatosPrefactibilidad): Calculo {
  const superficieTerreno = suma(d.terrenos.map((x) => x.frente * x.fondo));
  const nv = d.normativa;
  const fosPermitido = nv.fos != null && superficieTerreno ? Math.round(superficieTerreno * nv.fos * 100) / 100 : null;
  const capacidadFot = nv.fot != null && superficieTerreno ? Math.round(superficieTerreno * nv.fot * 100) / 100 : null;
  const cubierta = suma(d.pisos.map((p) => p.cubierta));
  const semicubierta = suma(d.pisos.map((p) => p.semicubierta));
  const descubierta = suma(d.pisos.map((p) => descubiertaTotal(p.descubiertas)));
  const gcba = suma(d.pisos.filter((p) => p.computaGcba).map((p) => p.cubierta + p.semicubierta));
  const conDescubiertas = suma(d.pisos.map(construiblePiso));
  const total = suma([cubierta, semicubierta, descubierta]);
  const teorico = suma(d.unidades.map(vendibleTeorico));
  const real = suma(d.unidades.map(vendibleReal));
  const avisos: Calculo["avisos"] = [];
  if (!superficieTerreno) avisos.push({ nivel: "atencion", texto: "Falta el frente y el fondo del terreno." });
  if (nv.fos == null) avisos.push({ nivel: "atencion", texto: "Falta el FOS del distrito: no se puede controlar la ocupación." });
  else if (fosPermitido != null && d.fosProyecto != null && d.fosProyecto > fosPermitido) avisos.push({ nivel: "error", texto: `FOS excedido: el proyecto ocupa ${d.fosProyecto} m² y se permiten ${fosPermitido} m².` });
  if (capacidadFot != null && gcba > capacidadFot) avisos.push({ nivel: "atencion", texto: `Lo construible según GCBA (${gcba} m²) supera el FOT (${capacidadFot} m²): se paga plusvalía por la diferencia.` });
  const pisosSobreRasante = d.pisos.filter((p) => !/subsuelo|sma|sala de m|azotea/i.test(p.nombre)).length;
  if (nv.pisosMaximos != null && pisosSobreRasante > nv.pisosMaximos) avisos.push({ nivel: "error", texto: `Hay ${pisosSobreRasante} plantas y el código permite ${nv.pisosMaximos}.` });
  for (const u of d.unidades) if (u.real != null && u.real > vendibleTeorico(u)) avisos.push({ nivel: "atencion", texto: `La ${u.codigo || "unidad"} tiene más vendible real (${u.real} m²) que teórico (${vendibleTeorico(u)} m²).` });
  return {
    superficieTerreno,
    fosPermitido,
    capacidadFot,
    construible: { cubierta, semicubierta, descubierta, gcba, conDescubiertas, total },
    vendible: { teorico, real, comunes: suma([conDescubiertas, -teorico]), porcentaje: conDescubiertas ? Math.round((teorico / conDescubiertas) * 1000) / 1000 : null },
    avisos,
  };
}

/* Planilla (pestañas "Prefactibilidades" y "Prefactibilidad Versiones"): los datos van en JSON en una celda. */

export const COLUMNAS_PREFACTIBILIDADES = ["ID", "Nombre", "Estado", "Proyecto", "Carpeta", "Creada", "Actualizada", "Editó", "Datos"] as const;
export const COLUMNAS_VERSIONES = ["ID", "ID prefactibilidad", "Nombre", "Fecha", "Autor", "Datos"] as const;

export const filaDePrefactibilidad = (p: Prefactibilidad) => [p.id, p.nombre, p.estado, p.proyecto, p.carpeta, p.creada, p.actualizada, p.edito, JSON.stringify(p.datos)];

export function prefactibilidadDeFila(f: string[]): Prefactibilidad {
  let datos: unknown = {};
  try {
    datos = JSON.parse(f[8] || "{}");
  } catch {
    datos = {};
  }
  const creada = f[5] ?? "";
  return {
    id: f[0] ?? "",
    nombre: f[1] ?? "",
    estado: (ESTADOS_PREFACTIBILIDAD as readonly string[]).includes(f[2] ?? "") ? (f[2] as EstadoPrefactibilidad) : "En análisis",
    proyecto: f[3] ?? "",
    carpeta: f[4] ?? "",
    creada,
    actualizada: f[6] || creada,
    edito: f[7] ?? "",
    datos: limpiarDatos(datos, creada.slice(0, 10) || "2000-01-01"),
  };
}

export const filaDeVersion = (v: Version) => [v.id, v.prefactibilidadId, v.nombre, v.fecha, v.autor, JSON.stringify(v.datos)];
export function versionDeFila(f: string[]): Version {
  let datos: unknown = {};
  try {
    datos = JSON.parse(f[5] || "{}");
  } catch {
    datos = {};
  }
  return { id: f[0] ?? "", prefactibilidadId: f[1] ?? "", nombre: f[2] ?? "", fecha: f[3] ?? "", autor: f[4] ?? "", datos: limpiarDatos(datos, (f[3] ?? "").slice(0, 10) || "2000-01-01") };
}

/** El link de la carpeta: solo de Drive (para no guardar cualquier cosa). "" si no es válido. */
export function carpetaValida(url: string): string {
  const u = url.trim();
  if (!u) return "";
  try {
    const x = new URL(u);
    return x.protocol === "https:" && /(^|\.)google\.com$/.test(x.hostname) ? x.toString() : "";
  } catch {
    return "";
  }
}

/**
 * Arma la prefactibilidad con lo que hoy está en el Excel madre: los pisos de "Superficies"
 * (construibles) y las unidades de la lista de precios (vendibles). Las descubiertas arrancan al
 * 50% en lo construible (en PB, al 0%) y en lo vendible al 33% (en PB, al 20%), como en el Excel:
 * después se ajusta cada una a mano.
 */
export function desdeExcel(o: {
  pisos: { nombre: string; cubierta: number; semicubierta: number; descubierta: number }[];
  unidades: { codigo: string; piso: string; tipologia: string; cubierta: number; semicubierta: number; descubierta: number }[];
  terreno?: { frente: number; fondo: number } | null;
  normativa?: Partial<Normativa>;
  direccion: string;
  hoy: string;
}): DatosPrefactibilidad {
  const esPb = (x: string) => /^pb$|planta baja/i.test(x.trim());
  const d = datosVacios(o.hoy);
  return {
    ...d,
    direccion: o.direccion,
    normativa: { ...d.normativa, ...o.normativa },
    terrenos: o.terreno ? [{ nombre: "Terreno 1", ...o.terreno }] : d.terrenos,
    pisos: o.pisos.map((p) => ({
      nombre: p.nombre,
      cubierta: p.cubierta,
      semicubierta: p.semicubierta,
      descubiertas: p.descubierta ? [{ nombre: esPb(p.nombre) ? "Patio" : "Terraza", m2: p.descubierta, computa: esPb(p.nombre) ? 0 : 0.5 }] : [],
      computaGcba: !/subsuelo|sma|azotea|sala de m/i.test(p.nombre),
    })),
    unidades: o.unidades.map((u) => ({
      codigo: u.codigo,
      piso: u.piso,
      tipologia: u.tipologia,
      cubierta: u.cubierta,
      semicubierta: u.semicubierta,
      descubiertas: u.descubierta ? [{ nombre: esPb(u.piso) ? "Patio" : "Terraza", m2: u.descubierta, computa: esPb(u.piso) ? 0.2 : 0.33 }] : [],
      real: null,
      nota: "",
    })),
  };
}

/**
 * Lee de la pestaña "Superficies" del Excel madre lo que sirve para la prefactibilidad: los pisos
 * construibles (entre "SUPERFICIES CONSTRUIBLES" y "TOTALES": nombre en B, cubierta en E,
 * semicubierta en F, descubierta en G), el terreno (Frente y Lateral) y la normativa del distrito.
 */
export function leerSuperficiesExcel(filas: { valor: number | string | null }[][]): {
  pisos: { nombre: string; cubierta: number; semicubierta: number; descubierta: number }[];
  terreno: { frente: number; fondo: number } | null;
  normativa: Partial<Normativa>;
  direccion: string;
} {
  const txt = (f: { valor: number | string | null }[] | undefined, i: number) => String(f?.[i]?.valor ?? "").trim();
  const num = (f: { valor: number | string | null }[] | undefined, i: number) => {
    const v = f?.[i]?.valor;
    const x = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
  };
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fila = (re: RegExp, desde = 0) => filas.findIndex((f, i) => i >= desde && re.test(norm(txt(f, 1))));
  const pisos: { nombre: string; cubierta: number; semicubierta: number; descubierta: number }[] = [];
  const ini = fila(/^superficies construibles/);
  if (ini >= 0) {
    for (let i = ini + 1; i < filas.length; i++) {
      const nombre = txt(filas[i], 1);
      const t = norm(nombre);
      if (/^totales/.test(t)) break;
      if (!nombre || /^proyecto|^vivienda/.test(t)) continue;
      pisos.push({ nombre, cubierta: num(filas[i], 4), semicubierta: num(filas[i], 5), descubierta: num(filas[i], 6) });
    }
  }
  const iTerreno = fila(/^terreno 1/);
  const terreno = iTerreno >= 0 && num(filas[iTerreno], 3) ? { frente: num(filas[iTerreno], 3), fondo: num(filas[iTerreno], 4) } : null;
  const iDistrito = filas.findIndex((f) => norm(txt(f, 1)) === "distrito");
  const d = iDistrito >= 0 ? filas[iDistrito + 2] : undefined;
  const nOpc = (f: { valor: number | string | null }[] | undefined, i: number) => (txt(f, i) ? num(f, i) : null);
  return {
    pisos,
    terreno,
    direccion: txt(filas[fila(/^direccion/)], 2),
    normativa: {
      tipologia: txt(d, 2),
      zonificacion: txt(d, 4),
      basamento: txt(d, 5),
      fot: nOpc(d, 6),
      fos: nOpc(d, 8),
      densidad: txt(d, 9),
      cocheraObligatoria: txt(d, 11),
      premio: txt(d, 12),
      alturaMaxima: iTerreno >= 0 ? nOpc(filas[iTerreno], 8) : null,
      pisosMaximos: iTerreno >= 0 ? nOpc(filas[iTerreno], 9) : null,
      retiros: iTerreno >= 0 ? txt(filas[iTerreno], 10) : "",
      lfi: iTerreno >= 0 ? txt(filas[iTerreno], 6) : "",
      proteccionHistorica: iTerreno >= 0 ? txt(filas[iTerreno], 11) : "",
    },
  };
}

const fmt = (x: number) => x.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const sumaTexto = (l: number[], max = 12) => (l.length ? (l.length > max ? `${l.slice(0, max).map(fmt).join(" + ")} + … (${l.length} valores)` : l.map(fmt).join(" + ")) : "0");

/** "La cuenta" de cada número de Superficies: de dónde sale, con los valores, para revisarla sin abrir nada. */
export function cuentas(d: DatosPrefactibilidad, c: Calculo): Record<string, string> {
  const gcba = d.pisos.filter((p) => p.computaGcba);
  const desc = d.pisos.flatMap((p) => p.descubiertas.map((x) => `${fmt(x.m2)} × ${fmt(x.computa * 100)}%`));
  const conReal = d.unidades.filter((u) => u.real != null);
  return {
    terreno: d.terrenos.map((t) => `${fmt(t.frente)} × ${fmt(t.fondo)}`).join(" + ") + ` = ${fmt(c.superficieTerreno)} m²`,
    fosPermitido: c.fosPermitido != null ? `${fmt(c.superficieTerreno)} × FOS ${fmt(d.normativa.fos!)} = ${fmt(c.fosPermitido)} m²` : "Falta el FOS.",
    capacidadFot: c.capacidadFot != null ? `${fmt(c.superficieTerreno)} × FOT ${fmt(d.normativa.fot!)} = ${fmt(c.capacidadFot)} m²` : "Falta el FOT.",
    gcba: `Cubierta + semicubierta de los pisos marcados GCBA (${gcba.map((p) => p.nombre).join(", ") || "ninguno"}): ${sumaTexto(gcba.flatMap((p) => [p.cubierta, p.semicubierta].filter(Boolean)))} = ${fmt(c.construible.gcba)} m²`,
    conDescubiertas: `Cubierta ${fmt(c.construible.cubierta)} + semicubierta ${fmt(c.construible.semicubierta)} + descubiertas a su % (${desc.join(" + ") || "ninguna"}) = ${fmt(c.construible.conDescubiertas)} m²`,
    total: `Cubierta ${fmt(c.construible.cubierta)} + semicubierta ${fmt(c.construible.semicubierta)} + descubiertas al 100% ${fmt(c.construible.descubierta)} = ${fmt(c.construible.total)} m²`,
    vendibleTeorico: `Suma de las ${d.unidades.length} unidades (cubierta + semicubierta + cada descubierta a su %): ${sumaTexto(d.unidades.map(vendibleTeorico))} = ${fmt(c.vendible.teorico)} m²`,
    vendibleReal: conReal.length ? `Lo teórico, salvo ${conReal.map((u) => `${u.codigo} (${fmt(u.real!)} en vez de ${fmt(vendibleTeorico(u))})`).join(", ")} = ${fmt(c.vendible.real)} m²` : `Igual a lo teórico (ninguna unidad tiene real distinto) = ${fmt(c.vendible.real)} m²`,
    comunes: `Construible con descubiertas ${fmt(c.construible.conDescubiertas)} − vendible teórico ${fmt(c.vendible.teorico)} = ${fmt(c.vendible.comunes)} m²`,
    porcentaje: c.vendible.porcentaje != null ? `Vendible teórico ${fmt(c.vendible.teorico)} ÷ construible con descubiertas ${fmt(c.construible.conDescubiertas)} = ${fmt(c.vendible.porcentaje * 100)}%` : "—",
  };
}

/** La cuenta del total de un piso o de lo teórico de una unidad. */
export const cuentaPiso = (p: PisoConstruible) => `${fmt(p.cubierta)} + ${fmt(p.semicubierta)}${p.descubiertas.map((x) => ` + ${fmt(x.m2)} × ${fmt(x.computa * 100)}%`).join("")} = ${fmt(construiblePiso(p))} m²`;
export const cuentaUnidad = (u: UnidadVendible) => `${fmt(u.cubierta)} + ${fmt(u.semicubierta)}${u.descubiertas.map((x) => ` + ${fmt(x.m2)} × ${fmt(x.computa * 100)}%`).join("")} = ${fmt(vendibleTeorico(u))} m²`;
