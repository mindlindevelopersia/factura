import "server-only";
import { googleClient } from "../google/auth";
import { colorDe, leerFlujo, mesDeHoy, type Celda, type FlujoIngresos } from "./ingresos";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

/** La planilla y la pestaña del flujo de fondos. Por defecto, la misma planilla contable de la app. */
export function configFlujo() {
  return {
    sheetId: process.env.FINANZAS_SHEET_ID || process.env.SHEET_ID || null,
    pestania: process.env.FINANZAS_TAB_FLUJO || "Flujo de fondos LERMA",
  };
}

export class FlujoSinConfigurar extends Error {}

/** La planilla cambia pocas veces por día: una lectura sirve unos minutos (y cuida la cuota de Sheets). */
const VIGENCIA_MS = 5 * 60_000;
let cache: { hasta: number; leido: string; flujo: Promise<FlujoIngresos> } | null = null;

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
 * Lee la pestaña con valores y colores de fondo (lo cobrado se marca con color, ver
 * docs/finanzas-ingresos.md). Solo lee: nunca escribe en la planilla.
 */
async function leer(): Promise<FlujoIngresos> {
  const { sheetId, pestania } = configFlujo();
  const client = googleClient();
  if (!client || !sheetId) throw new FlujoSinConfigurar("Falta configurar la planilla (SHEET_ID y la cuenta de servicio de Google).");
  const rango = `'${pestania.replace(/'/g, "''")}'!A1:CZ400`;
  const campos = "sheets.data.rowData.values(effectiveValue,effectiveFormat.backgroundColor)";
  const r = await client.request<RespuestaGrilla>({
    url: `${SHEETS}/${sheetId}?ranges=${encodeURIComponent(rango)}&includeGridData=true&fields=${encodeURIComponent(campos)}`,
  });
  const filas: Celda[][] = (r.data.sheets?.[0]?.data?.[0]?.rowData ?? []).map((fila) =>
    (fila.values ?? []).map((v) => {
      const e = v.effectiveValue;
      const valor = e?.numberValue ?? e?.stringValue ?? (e?.errorValue ? `#${e.errorValue.type ?? "ERROR"}` : e?.boolValue != null ? String(e.boolValue) : null);
      return { valor, color: colorDe(v.effectiveFormat?.backgroundColor) };
    }),
  );
  if (!filas.length) throw new Error(`La pestaña "${pestania}" está vacía o no existe.`);
  return leerFlujo(filas, mesDeHoy());
}

/** El flujo de ingresos, de la última lectura si tiene menos de 5 minutos. fresco: true la lee de nuevo. */
export async function flujoIngresos({ fresco = false } = {}): Promise<{ flujo: FlujoIngresos; leido: string }> {
  if (fresco || !cache || cache.hasta < Date.now()) {
    const flujo = leer();
    cache = { hasta: Date.now() + VIGENCIA_MS, leido: new Date().toISOString(), flujo };
    flujo.catch(() => {
      if (cache?.flujo === flujo) cache = null;
    });
  }
  return { flujo: await cache.flujo, leido: cache.leido };
}
