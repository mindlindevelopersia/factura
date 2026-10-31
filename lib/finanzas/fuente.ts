import "server-only";
import { googleClient } from "../google/auth";
import { leerCac, type SerieCac } from "../indicadores/cac";
import { analizarTodos, type AnalisisMaterial } from "../indicadores/materiales";
import {
  combinar,
  dolarDeArgentinaDatos,
  leerDolarMensual,
  leerIpc,
  leerPreciosMedios,
  serieDeDatosGob,
  seriesDeCac,
  type Punto,
  type SerieMensual,
} from "../indicadores/series";
import { COLUMNAS_AVISOS, RegistroAvisos } from "../inversores/avisos";
import { armarCobranzas, hoyBuenosAires, totalesCobranzas } from "../inversores/cobranzas";
import { leerBloques, unirConFlujo, type CuentasCorrientes } from "../inversores/cuentas";
import { PestaniaSimple } from "../google/pestania";
import { proyecto as buscarProyecto } from "../modulos";
import { armarComercial, type Comercial } from "../proyectos/comercial";
import { analizarHq, desarrolladores, m2DesarrolladoresEnPlanilla, type Desarrolladores, type GastoHq } from "../proyectos/management";
import { leerCaja, unir, type CajaEgresos } from "./egresos";
import { colorDe, leerFlujo, mesDeHoy, type Celda, type FlujoIngresos } from "./ingresos";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

/** Las pestañas que lee Finanzas. Por defecto, de la misma planilla contable de la app. */
export function configFinanzas() {
  return {
    sheetId: process.env.FINANZAS_SHEET_ID || process.env.SHEET_ID || null,
    flujo: process.env.FINANZAS_TAB_FLUJO || "Flujo de fondos LERMA",
    cajaPesos: process.env.FINANZAS_TAB_CAJA_ARS || "Caja Flujos en Pesos",
    cajaDolares: process.env.FINANZAS_TAB_CAJA_USD || "Caja Flujos en Dólares Global",
    pagosInversor: process.env.INVERSORES_TAB_PAGOS || "Pagos por Inversor",
  };
}

export class FlujoSinConfigurar extends Error {}

/** La planilla cambia pocas veces por día: una lectura sirve unos minutos (y cuida la cuota de Sheets). */
const VIGENCIA_MS = 5 * 60_000;

interface RespuestaGrilla {
  sheets?: {
    data?: {
      rowData?: {
        values?: {
          effectiveValue?: { numberValue?: number; stringValue?: string; boolValue?: boolean; errorValue?: { type?: string } };
          effectiveFormat?: { backgroundColor?: { red?: number; green?: number; blue?: number } };
        }[];
      }[];
    }[];
  }[];
}

/**
 * Lee una pestaña como grilla de valores (y colores de fondo, si se piden). Solo lee: nunca
 * escribe en la planilla. Las fechas vienen como número de serie.
 */
async function leerGrilla(pestania: string, a1: string, colores: boolean, planilla?: string | null): Promise<Celda[][]> {
  const sheetId = planilla === undefined ? configFinanzas().sheetId : planilla;
  const client = googleClient();
  if (!client || !sheetId) throw new FlujoSinConfigurar("Falta configurar la planilla (SHEET_ID y la cuenta de servicio de Google).");
  const rango = `'${pestania.replace(/'/g, "''")}'!${a1}`;
  const campos = `sheets.data.rowData.values(effectiveValue${colores ? ",effectiveFormat.backgroundColor" : ""})`;
  const r = await client.request<RespuestaGrilla>({
    url: `${SHEETS}/${sheetId}?ranges=${encodeURIComponent(rango)}&includeGridData=true&fields=${encodeURIComponent(campos)}`,
  });
  const filas: Celda[][] = (r.data.sheets?.[0]?.data?.[0]?.rowData ?? []).map((fila) =>
    (fila.values ?? []).map((v) => {
      const e = v.effectiveValue;
      const valor = e?.numberValue ?? e?.stringValue ?? (e?.errorValue ? `#${e.errorValue.type ?? "ERROR"}` : e?.boolValue != null ? String(e.boolValue) : null);
      return { valor, color: colores ? colorDe(v.effectiveFormat?.backgroundColor) : null };
    }),
  );
  if (!filas.length) throw new Error(`La pestaña "${pestania}" está vacía o no existe.`);
  return filas;
}

/** Guarda una lectura unos minutos; si falla, no la guarda. */
function conCache<T>(leer: () => Promise<T>) {
  let cache: { hasta: number; leido: string; valor: Promise<T> } | null = null;
  return async ({ fresco = false } = {}): Promise<{ valor: T; leido: string }> => {
    if (fresco || !cache || cache.hasta < Date.now()) {
      const valor = leer();
      const actual = { hasta: Date.now() + VIGENCIA_MS, leido: new Date().toISOString(), valor };
      cache = actual;
      valor.catch(() => {
        if (cache === actual) cache = null;
      });
    }
    const { valor, leido } = cache;
    return { valor: await valor, leido };
  };
}

const ingresos = conCache(async () => leerFlujo(await leerGrilla(configFinanzas().flujo, "A1:CZ400", true), mesDeHoy()));

/** El flujo de ingresos (pestaña "Flujo de fondos LERMA"), con valores y colores. */
export async function flujoIngresos(opciones?: { fresco?: boolean }): Promise<{ flujo: FlujoIngresos; leido: string }> {
  const { valor, leido } = await ingresos(opciones);
  return { flujo: valor, leido };
}

const egresos = conCache(async () => {
  const { cajaPesos, cajaDolares } = configFinanzas();
  const mes = mesDeHoy();
  const [pesos, dolares] = await Promise.all([leerGrilla(cajaPesos, "A1:P5000", false), leerGrilla(cajaDolares, "A1:P5000", false)]);
  return unir(leerCaja(pesos, "ARS", cajaPesos, mes), leerCaja(dolares, "USD", cajaDolares, mes));
});

/** Los egresos de las dos pestañas de caja (pesos y dólares). */
export async function cajaEgresos(opciones?: { fresco?: boolean }): Promise<{ caja: CajaEgresos; leido: string }> {
  const { valor, leido } = await egresos(opciones);
  return { caja: valor, leido };
}

const pagosInversor = conCache(async () => leerGrilla(configFinanzas().pagosInversor, "A1:LZ300", false));

/** Las cuentas corrientes: los bloques de "Pagos por Inversor" unidos con lo pendiente del Flujo de fondos. */
export async function cuentasCorrientes(opciones?: { fresco?: boolean }): Promise<{ cuentas: CuentasCorrientes; leido: string }> {
  const [bloques, { flujo }] = await Promise.all([pagosInversor(opciones), flujoIngresos(opciones)]);
  return { cuentas: unirConFlujo(leerBloques(bloques.valor, flujo.mesActual), flujo), leido: bloques.leido };
}

/** La planilla "Indicadores - REAL ESTATE", que se carga aparte de la contable. */
export function configIndicadores() {
  return {
    sheetId: process.env.INDICADORES_SHEET_ID || "1k0I2O86bJJzbXmPP8v197-VU1OlAtAbIIQV32FOp_HU",
    cac: process.env.INDICADORES_TAB_CAC || "Índice CAC",
  };
}

const cac = conCache(async () => {
  const { sheetId, cac: pestania } = configIndicadores();
  try {
    return leerCac(await leerGrilla(pestania, "A1:F2000", false, sheetId));
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status;
    if (status === 403 || status === 404) {
      throw new Error(
        `La app no tiene acceso a la planilla de indicadores. Compartila como Lector con ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "la cuenta de servicio"}.`,
      );
    }
    throw e;
  }
});

/** La serie del índice CAC (costo de construcción, materiales y mano de obra). */
export async function serieCac(opciones?: { fresco?: boolean }): Promise<{ serie: SerieCac; leido: string }> {
  const { valor, leido } = await cac(opciones);
  return { serie: valor, leido };
}

/** El registro de avisos de cobranza, en la planilla de la cola. Null si falta configurarla. */
export function registroAvisos(): RegistroAvisos | null {
  const client = googleClient();
  if (!client || !process.env.COLA_SHEET_ID) return null;
  return new RegistroAvisos(new PestaniaSimple(client, process.env.COLA_SHEET_ID, process.env.COBRANZAS_TAB || "Cobranzas", COLUMNAS_AVISOS));
}

/** Las cobranzas: cuentas corrientes y CAC (si no se puede leer, sin actualizar los montos). */
export async function cobranzas(opciones?: { fresco?: boolean }) {
  const [{ cuentas, leido }, cac] = await Promise.all([
    cuentasCorrientes(opciones),
    serieCac(opciones).then(
      (r) => ({ serie: r.serie, error: null as string | null }),
      (e: unknown) => ({ serie: null, error: e instanceof Error ? e.message : String(e) }),
    ),
  ]);
  const hoy = hoyBuenosAires();
  const lista = armarCobranzas(cuentas, cac.serie, hoy);
  return { cobranzas: lista, totales: totalesCobranzas(lista, hoy), hoy, cacUltimo: cac.serie?.ultimo ?? null, errorCac: cac.error, leido };
}

/** Fuentes públicas en línea, que se consultan desde el servidor (Vercel). */
export const FUENTES_EN_LINEA = {
  ipc: { url: "https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=1000&format=json", nombre: "INDEC (datos.gob.ar)" },
  blue: { url: "https://api.argentinadatos.com/v1/cotizaciones/dolares/blue", nombre: "ArgentinaDatos" },
  oficial: { url: "https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial", nombre: "ArgentinaDatos" },
};

async function enLinea(url: string, leer: (datos: unknown) => Punto[]): Promise<{ puntos: Punto[]; error: string | null }> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" }, cache: "no-store" });
    if (!r.ok) return { puntos: [], error: `respondió ${r.status}` };
    const puntos = leer(await r.json());
    return { puntos, error: puntos.length ? null : "respuesta sin datos" };
  } catch (e) {
    return { puntos: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export interface EstadoFuente {
  serie: string;
  fuente: string;
  /** Último mes con dato. */
  ultimo: string | null;
  enLinea: boolean;
  error: string | null;
}

export interface Panorama {
  series: SerieMensual[];
  materiales: AnalisisMaterial[];
  fuentes: EstadoFuente[];
  cacUltimo: string | null;
}

const panorama = conCache(async (): Promise<Panorama> => {
  const { sheetId } = configIndicadores();
  const pestania = (nombre: string, a1: string) => leerGrilla(nombre, a1, false, sheetId).catch(() => [] as Celda[][]);
  const [{ serie: cac }, ipcHoja, blueHoja, oficialHoja, precios, ipcWeb, blueWeb, oficialWeb] = await Promise.all([
    serieCac(),
    pestania("IPC", "A1:EZ12"),
    pestania("Tipo de Cambio Blue", "A1:H4000"),
    pestania("Tipo de Cambio Oficial", "A1:H4000"),
    pestania("Precios Medios", "A1:LZ80"),
    enLinea(FUENTES_EN_LINEA.ipc.url, serieDeDatosGob),
    enLinea(FUENTES_EN_LINEA.blue.url, dolarDeArgentinaDatos),
    enLinea(FUENTES_EN_LINEA.oficial.url, dolarDeArgentinaDatos),
  ]);
  const fuentes: EstadoFuente[] = [];
  const armar = (id: string, nombre: string, grupo: string, unidad: string, web: { puntos: Punto[]; error: string | null }, nombreWeb: string, hoja: Punto[]): SerieMensual => {
    const puntos = combinar(web.puntos, hoja);
    const usaWeb = web.puntos.length > 0;
    fuentes.push({ serie: nombre, fuente: usaWeb ? nombreWeb : "Planilla de indicadores", ultimo: puntos.at(-1)?.mes ?? null, enLinea: usaWeb, error: web.error });
    return { id, nombre, grupo, unidad, fuente: usaWeb ? nombreWeb : "Planilla de indicadores", puntos };
  };
  const ipc = armar("ipc", "Inflación (IPC)", "Precios", "índice", ipcWeb, FUENTES_EN_LINEA.ipc.nombre, leerIpc(ipcHoja));
  const blue = armar("blue", "Dólar blue", "Dólar", "$ por US$", blueWeb, FUENTES_EN_LINEA.blue.nombre, leerDolarMensual(blueHoja));
  const oficial = armar("oficial", "Dólar oficial", "Dólar", "$ por US$", oficialWeb, FUENTES_EN_LINEA.oficial.nombre, leerDolarMensual(oficialHoja));
  const deCac = seriesDeCac(cac);
  for (const s of deCac) fuentes.unshift({ serie: s.nombre, fuente: "Planilla de indicadores (Índice CAC)", ultimo: s.puntos.at(-1)?.mes ?? null, enLinea: false, error: null });
  const insumos = leerPreciosMedios(precios);
  const materiales = analizarTodos(insumos, deCac[0], blue.puntos.length ? blue : null);
  const destacados = insumos
    .filter((i) => i.id === "142001" || i.id === "4001")
    .map((i): SerieMensual => ({ id: `insumo-${i.id}`, nombre: i.id === "4001" ? "Hierro 12 mm" : "Hormigón H30", grupo: "Materiales", unidad: `$ por ${i.unidad}`, fuente: "Precios Medios (planilla)", puntos: i.puntos }));
  for (const d of destacados) fuentes.push({ serie: d.nombre, fuente: d.fuente, ultimo: d.puntos.at(-1)?.mes ?? null, enLinea: false, error: null });
  return { series: [...deCac, ipc, blue, oficial, ...destacados], materiales, fuentes, cacUltimo: cac.ultimo };
});

/** Todo lo del Panorama de indicadores y la alarma de materiales. */
export async function datosPanorama(opciones?: { fresco?: boolean }): Promise<Panorama & { leido: string }> {
  // "Actualizar" también vuelve a leer el CAC (el Panorama usa la lectura guardada del Índice CAC).
  if (opciones?.fresco) await serieCac({ fresco: true }).catch(() => undefined);
  const { valor, leido } = await panorama(opciones);
  return { ...valor, leido };
}

export interface DatosComercial {
  comercial: Comercial;
  desarrolladores: Desarrolladores | null;
}

/** El Excel madre de un proyecto (con una variable para cambiarlo sin tocar el código). */
function planillaMadre(id: string): string | null {
  const p = buscarProyecto(id);
  const env = process.env[`MADRE_SHEET_ID_${id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  return env || p?.planillaMadre || null;
}

const comercialPorProyecto = new Map<string, ReturnType<typeof conCache<DatosComercial>>>();

/** Unidades, lista de precios, superficies y ventas del proyecto, con los cruces y el management. */
export async function datosComercial(id: string, opciones?: { fresco?: boolean }): Promise<DatosComercial & { leido: string }> {
  const p = buscarProyecto(id);
  const sheet = planillaMadre(id);
  if (!p || !sheet) throw new FlujoSinConfigurar(`El proyecto no tiene configurado su Excel madre.`);
  let lector = comercialPorProyecto.get(id);
  if (!lector) {
    lector = conCache(async () => {
      const pestania = (nombre: string, a1: string) =>
        leerGrilla(nombre, a1, false, sheet).catch((e) => {
          const status = (e as { response?: { status?: number } }).response?.status;
          if (status === 403 || status === 404) {
            throw new Error(`La app no tiene acceso al Excel madre. Compartilo como Lector con ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "la cuenta de servicio"}.`);
          }
          throw e;
        });
      const [lista, ventas, superficies, eerr, cuentas, caja] = await Promise.all([
        pestania("Lista de precios", "A1:Z120"),
        pestania("Ventas", "A1:P120").catch(() => [] as Celda[][]),
        pestania("Superficies", "A1:T120").catch(() => [] as Celda[][]),
        pestania("EE.RR", "A1:P140").catch(() => [] as Celda[][]),
        // Los cruces son de Lerma (sus cuentas y su caja); si no se pueden leer, se sigue sin ellos.
        cuentasCorrientes().then((r) => r.cuentas.cuentas, () => null),
        cajaEgresos().then((r) => r.caja, () => null),
      ]);
      const comercial = armarComercial(
        lista,
        ventas,
        superficies,
        cuentas?.map((c) => ({ unidad: c.unidad, inversor: c.inversor, precioUsd: c.precioUsd })) ?? null,
        p.ajustes,
      );
      let hq: GastoHq | null = null;
      if (caja) {
        hq = analizarHq(caja.egresos);
      }
      const dev = p.management ? desarrolladores(comercial.unidades, p.management.parteM2, p.management.socios, m2DesarrolladoresEnPlanilla(eerr), hq) : null;
      return { comercial, desarrolladores: dev };
    });
    comercialPorProyecto.set(id, lector);
  }
  const { valor, leido } = await lector(opciones);
  return { ...valor, leido };
}
