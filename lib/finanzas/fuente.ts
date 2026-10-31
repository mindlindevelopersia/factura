import "server-only";
import { googleClient } from "../google/auth";
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
async function leerGrilla(pestania: string, a1: string, colores: boolean): Promise<Celda[][]> {
  const { sheetId } = configFinanzas();
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
