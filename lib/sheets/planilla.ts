import type { JWT } from "google-auth-library";
import { googleClient } from "../google/auth";
import { COLUMNAS, filaPlanilla, letraColumna, type DatosFila } from "./columnas";

/** Dónde se registran las facturas. Hoy Google Sheets; si el cliente usa Excel, otra implementación. */
export interface Planilla {
  /** true si ya hay una fila con esa clave de duplicado. */
  existe(clave: string): Promise<boolean>;
  /** Agrega la fila y devuelve su número en la planilla. */
  agregar(datos: DatosFila): Promise<{ fila: number | null }>;
}

const ULTIMA = letraColumna(COLUMNAS.length - 1);
const COLUMNA_CLAVE = ULTIMA;

export class GoogleSheetsPlanilla implements Planilla {
  private preparada: Promise<void> | null = null;

  constructor(
    private readonly client: JWT,
    private readonly sheetId: string,
    private readonly pestania: string,
  ) {}

  private url(path: string) {
    return `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${path}`;
  }

  private rango(a1: string) {
    return encodeURIComponent(`'${this.pestania.replace(/'/g, "''")}'!${a1}`);
  }

  /** Deja la pestaña lista una vez por instancia: columnas suficientes y encabezados. */
  private preparar(): Promise<void> {
    this.preparada ??= (async () => {
      await this.asegurarColumnas();
      await this.asegurarEncabezados();
    })().catch((e) => {
      this.preparada = null;
      throw e;
    });
    return this.preparada;
  }

  /** Una planilla nueva tiene 26 columnas; la app usa más. Agrega las que falten. */
  private async asegurarColumnas() {
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}`;
    const r = await this.client.request<{
      sheets: { properties: { sheetId: number; title: string; gridProperties: { columnCount: number } } }[];
    }>({ url: `${base}?fields=sheets.properties` });
    const hoja = r.data.sheets.find((s) => s.properties.title === this.pestania)?.properties;
    if (!hoja) throw new Error(`La planilla no tiene una pestaña "${this.pestania}"`);
    const faltan = COLUMNAS.length - hoja.gridProperties.columnCount;
    if (faltan <= 0) return;
    await this.client.request({
      url: `${base}:batchUpdate`,
      method: "POST",
      data: { requests: [{ appendDimension: { sheetId: hoja.sheetId, dimension: "COLUMNS", length: faltan } }] },
    });
  }

  /** Si la pestaña está vacía, escribe los títulos de las columnas en la fila 1. */
  private async asegurarEncabezados() {
    const r = await this.client.request<{ values?: string[][] }>({ url: this.url(this.rango(`A1:${ULTIMA}1`)) });
    if (r.data.values?.[0]?.some((v) => v !== "")) return;
    await this.client.request({
      url: `${this.url(this.rango(`A1:${ULTIMA}1`))}?valueInputOption=RAW`,
      method: "PUT",
      data: { values: [COLUMNAS.map((c) => c.titulo)] },
    });
  }

  async existe(clave: string): Promise<boolean> {
    await this.preparar();
    const r = await this.client.request<{ values?: string[][] }>({
      url: this.url(this.rango(`${COLUMNA_CLAVE}2:${COLUMNA_CLAVE}`)),
    });
    return (r.data.values ?? []).some((fila) => fila[0] === clave);
  }

  async agregar(datos: DatosFila): Promise<{ fila: number | null }> {
    await this.preparar();
    const r = await this.client.request<{ updates?: { updatedRange?: string } }>({
      url: `${this.url(this.rango(`A1:${ULTIMA}1`))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      method: "POST",
      data: { values: [filaPlanilla(datos)] },
    });
    const fila = r.data.updates?.updatedRange?.match(/!A(\d+):/)?.[1];
    return { fila: fila ? Number(fila) : null };
  }
}

/** La planilla configurada en las variables de entorno, o null si falta configurarla. */
export function planillaDesdeEnv(): Planilla | null {
  const client = googleClient();
  const sheetId = process.env.SHEET_ID;
  if (!client || !sheetId) return null;
  return new GoogleSheetsPlanilla(client, sheetId, process.env.SHEET_TAB || "Hoja 1");
}
