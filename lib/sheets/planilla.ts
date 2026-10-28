import type { JWT } from "google-auth-library";
import { googleClient } from "../google/auth";
import { COLUMNAS, filaPlanilla, indiceColumna, letraColumna, pestaniaDe, type DatosFila, type Pestania } from "./columnas";
import { leerRegistros, RANGO_EGRESOS, RANGO_INGRESOS, type Registros } from "./registros";

/** Dónde se registran las facturas. Hoy Google Sheets; si el cliente usa Excel, otra implementación. */
export interface Planilla {
  /** true si la pestaña está configurada. */
  tiene(pestania: Pestania): boolean;
  /** Lo que ya está cargado en las dos pestañas, para duplicados e historial. */
  registros(): Promise<Registros>;
  /** Agrega la fila en la pestaña que corresponde a la factura y devuelve su número. */
  agregar(datos: DatosFila): Promise<{ pestania: string; fila: number | null }>;
}

export class PestaniaSinConfigurar extends Error {
  constructor(pestania: Pestania) {
    super(`Falta configurar la pestaña de ${pestania === "ingresos" ? "ventas (SHEET_TAB_INGRESOS)" : "compras (SHEET_TAB_EGRESOS)"}.`);
    this.name = "PestaniaSinConfigurar";
  }
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

export class GoogleSheetsPlanilla implements Planilla {
  private ids: Promise<Map<string, number>> | null = null;
  private readonly preparadas = new Set<string>();

  constructor(
    private readonly client: JWT,
    private readonly sheetId: string,
    private readonly pestanias: Record<Pestania, string | null>,
  ) {}

  tiene(pestania: Pestania): boolean {
    return this.pestanias[pestania] != null;
  }

  private rango(pestania: string, a1: string) {
    return `'${pestania.replace(/'/g, "''")}'!${a1}`;
  }

  private valores(rango: string) {
    return `${SHEETS}/${this.sheetId}/values/${encodeURIComponent(rango)}`;
  }

  /** ID numérico de cada pestaña por nombre: lo piden las operaciones de formato. */
  private idDe(pestania: string): Promise<number> {
    this.ids ??= this.client
      .request<{ sheets: { properties: { sheetId: number; title: string } }[] }>({
        url: `${SHEETS}/${this.sheetId}?fields=sheets.properties(sheetId,title)`,
      })
      .then((r) => new Map(r.data.sheets.map((s) => [s.properties.title, s.properties.sheetId])))
      .catch((e) => {
        this.ids = null;
        throw e;
      });
    return this.ids.then((m) => {
      const id = m.get(pestania);
      if (id === undefined) throw new Error(`La planilla no tiene una pestaña "${pestania}"`);
      return id;
    });
  }

  /** Si la pestaña está vacía (una planilla de prueba nueva), escribe los títulos en la fila 1. */
  private async asegurarEncabezados(pestania: string, tipo: Pestania) {
    if (this.preparadas.has(pestania)) return;
    const columnas = COLUMNAS[tipo];
    const fila1 = this.rango(pestania, `A1:${letraColumna(columnas.length - 1)}1`);
    const r = await this.client.request<{ values?: string[][] }>({ url: this.valores(fila1) });
    if (!r.data.values?.[0]?.some((v) => v !== "")) {
      await this.client.request({
        url: `${this.valores(fila1)}?valueInputOption=RAW`,
        method: "PUT",
        data: { values: [columnas.map((c) => c.titulo)] },
      });
    }
    this.preparadas.add(pestania);
  }

  async registros(): Promise<Registros> {
    const egresos = this.pestanias.egresos;
    if (!egresos) throw new PestaniaSinConfigurar("egresos");
    const ingresos = this.pestanias.ingresos;
    const rangos = [this.rango(egresos, RANGO_EGRESOS), ...(ingresos ? [this.rango(ingresos, RANGO_INGRESOS)] : [])];
    const query = rangos.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
    const r = await this.client.request<{ valueRanges: { values?: string[][] }[] }>({
      url: `${SHEETS}/${this.sheetId}/values:batchGet?${query}`,
    });
    const [e, i] = r.data.valueRanges;
    return leerRegistros(e?.values ?? [], i?.values ?? []);
  }

  async agregar(datos: DatosFila): Promise<{ pestania: string; fila: number | null }> {
    const tipo = pestaniaDe(datos.factura);
    const pestania = this.pestanias[tipo];
    if (!pestania) throw new PestaniaSinConfigurar(tipo);
    await this.asegurarEncabezados(pestania, tipo);

    const ultima = letraColumna(COLUMNAS[tipo].length - 1);
    // OVERWRITE escribe en la primera fila vacía debajo de los datos, como cuando se carga a mano.
    // Las celdas en null (forma de pago, banco, retención...) no se tocan.
    const r = await this.client.request<{ updates?: { updatedRange?: string } }>({
      url: `${this.valores(this.rango(pestania, `A1:${ultima}1`))}:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE`,
      method: "POST",
      data: { values: [filaPlanilla(datos)] },
    });
    const n = r.data.updates?.updatedRange?.match(/!A(\d+):/)?.[1];
    const fila = n ? Number(n) : null;

    if (fila) {
      try {
        await this.retocar(pestania, tipo, fila, datos.link);
      } catch (e) {
        // La fila ya está cargada: sin el retoque queda el link sin formato y sin el monto a transferir.
        console.error(`No se pudo dar formato a la fila ${fila} de "${pestania}"`, e);
      }
    }
    return { pestania, fila };
  }

  /**
   * Deja la fila como las que se cargan a mano: el formato de la fila de arriba, fechas en
   * dd/mm/aaaa, el link como "Link" y, en egresos, el monto a transferir con la fórmula =T-U.
   */
  private async retocar(pestania: string, tipo: Pestania, fila: number, link: string | null) {
    const sheetId = await this.idDe(pestania);
    const columnas = COLUMNAS[tipo].length;
    const filaDe = (n: number, desde = 0, hasta = columnas) => ({
      sheetId,
      startRowIndex: n - 1,
      endRowIndex: n,
      startColumnIndex: desde,
      endColumnIndex: hasta,
    });
    const celda = (columna: number) => ({ sheetId, rowIndex: fila - 1, columnIndex: columna });

    const requests: object[] = [];
    if (fila > 2) {
      requests.push({ copyPaste: { source: filaDe(fila - 1), destination: filaDe(fila), pasteType: "PASTE_FORMAT" } });
    }
    requests.push({
      repeatCell: {
        range: filaDe(fila, 0, 2),
        cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    });
    if (link) {
      requests.push({
        updateCells: {
          start: celda(indiceColumna(tipo, tipo === "egresos" ? "Factura" : "Link")),
          rows: [{ values: [{ userEnteredValue: { stringValue: "Link" }, textFormatRuns: [{ startIndex: 0, format: { link: { uri: link } } }] }] }],
          fields: "userEnteredValue,textFormatRuns",
        },
      });
    }
    if (tipo === "egresos") {
      const total = letraColumna(indiceColumna(tipo, "Importe Total"));
      const retencion = letraColumna(indiceColumna(tipo, "Retención Impuesto a las Ganancias"));
      requests.push({
        updateCells: {
          start: celda(indiceColumna(tipo, "Monto a Transferir")),
          rows: [{ values: [{ userEnteredValue: { formulaValue: `=${total}${fila}-${retencion}${fila}` } }] }],
          fields: "userEnteredValue",
        },
      });
    }
    await this.client.request({ url: `${SHEETS}/${this.sheetId}:batchUpdate`, method: "POST", data: { requests } });
  }
}

/** La planilla configurada en las variables de entorno, o null si falta configurarla. */
export function planillaDesdeEnv(): Planilla | null {
  const client = googleClient();
  const sheetId = process.env.SHEET_ID;
  if (!client || !sheetId) return null;
  return new GoogleSheetsPlanilla(client, sheetId, {
    // SHEET_TAB es el nombre anterior de la variable de egresos.
    egresos: process.env.SHEET_TAB_EGRESOS || process.env.SHEET_TAB || "Hoja 1",
    ingresos: process.env.SHEET_TAB_INGRESOS || null,
  });
}
