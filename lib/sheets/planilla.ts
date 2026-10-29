import type { JWT } from "google-auth-library";
import { googleClient } from "../google/auth";
import { COLUMNAS, filaConOpcionales, indiceColumna, letraColumna, pestaniaDe, type DatosFila, type Pestania } from "./columnas";
import { leerRegistros, RANGO_EGRESOS, RANGO_FECHAS, RANGO_INGRESOS, type Registros } from "./registros";

/** Dónde se registran las facturas. Hoy Google Sheets; si el cliente usa Excel, otra implementación. */
export interface Planilla {
  /** true si la pestaña está configurada. */
  tiene(pestania: Pestania): boolean;
  /**
   * Lo que ya está cargado en las dos pestañas, para duplicados, historial y el panel.
   * Puede venir de una lectura de hace unos segundos; fresco: true la lee de nuevo (lo usa
   * la aprobación, que no puede trabajar con datos viejos).
   */
  registros(opciones?: { fresco?: boolean }): Promise<Registros>;
  /** Agrega la fila en la pestaña que corresponde a la factura y devuelve su número. */
  agregar(datos: DatosFila): Promise<{ pestania: string; fila: number | null }>;
  /** Link a la pestaña en Google Sheets, y a la fila si se pasa. */
  enlace?(pestania: Pestania, fila?: number): Promise<string>;
}

/**
 * Cuánto se reusa una lectura de la planilla. La web consulta la cola cada 20 segundos por
 * persona y el panel también lee la planilla: sin esto, con varias personas con la web
 * abierta se agota la cuota de lecturas de Sheets (60 por minuto para la cuenta de servicio).
 */
export const REGISTROS_VIGENCIA_MS = 30_000;
const lecturas = new Map<string, { hasta: number; registros: Promise<Registros> }>();

export class PestaniaSinConfigurar extends Error {
  constructor(pestania: Pestania) {
    super(`Falta configurar la pestaña de ${pestania === "ingresos" ? "ventas (SHEET_TAB_INGRESOS)" : "compras (SHEET_TAB_EGRESOS)"}.`);
    this.name = "PestaniaSinConfigurar";
  }
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

export class GoogleSheetsPlanilla implements Planilla {
  private ids: Promise<Map<string, number>> | null = null;
  private readonly encabezados = new Map<string, string[]>();

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

  /**
   * Los títulos de la fila 1, para encontrar las columnas opcionales. Si la pestaña está vacía
   * (una planilla de prueba nueva), primero los escribe.
   */
  private async leerEncabezados(pestania: string, tipo: Pestania): Promise<string[]> {
    const guardados = this.encabezados.get(pestania);
    if (guardados) return guardados;
    const fila1 = this.rango(pestania, "1:1");
    const r = await this.client.request<{ values?: string[][] }>({ url: this.valores(fila1) });
    let titulos = r.data.values?.[0] ?? [];
    if (!titulos.some((v) => v !== "")) {
      titulos = COLUMNAS[tipo].map((c) => c.titulo);
      await this.client.request({
        url: `${this.valores(this.rango(pestania, "A1"))}?valueInputOption=RAW`,
        method: "PUT",
        data: { values: [titulos] },
      });
    }
    this.encabezados.set(pestania, titulos);
    return titulos;
  }

  private claveLectura() {
    return `${this.sheetId}|${this.pestanias.egresos}|${this.pestanias.ingresos}`;
  }

  async registros({ fresco = false }: { fresco?: boolean } = {}): Promise<Registros> {
    const clave = this.claveLectura();
    const guardada = lecturas.get(clave);
    if (!fresco && guardada && guardada.hasta > Date.now()) return guardada.registros;
    const registros = this.leerRegistros();
    lecturas.set(clave, { hasta: Date.now() + REGISTROS_VIGENCIA_MS, registros });
    registros.catch(() => {
      if (lecturas.get(clave)?.registros === registros) lecturas.delete(clave);
    });
    return registros;
  }

  private async leerRegistros(): Promise<Registros> {
    const egresos = this.pestanias.egresos;
    if (!egresos) throw new PestaniaSinConfigurar("egresos");
    const ingresos = this.pestanias.ingresos;
    const rangos = [
      this.rango(egresos, RANGO_EGRESOS),
      this.rango(egresos, RANGO_FECHAS),
      ...(ingresos ? [this.rango(ingresos, RANGO_INGRESOS), this.rango(ingresos, RANGO_FECHAS)] : []),
    ];
    const query = rangos.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
    const r = await this.client.request<{ valueRanges: { values?: (string | number | boolean)[][] }[] }>({
      url: `${SHEETS}/${this.sheetId}/values:batchGet?${query}&valueRenderOption=UNFORMATTED_VALUE`,
    });
    const [e, fe, i, fi] = r.data.valueRanges;
    return leerRegistros(e?.values ?? [], i?.values ?? [], { egresos: fe?.values ?? [], ingresos: fi?.values ?? [] });
  }

  async enlace(tipo: Pestania, fila?: number): Promise<string> {
    const pestania = this.pestanias[tipo];
    if (!pestania) throw new PestaniaSinConfigurar(tipo);
    const gid = await this.idDe(pestania);
    return `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit#gid=${gid}${fila ? `&range=A${fila}` : ""}`;
  }

  async agregar(datos: DatosFila): Promise<{ pestania: string; fila: number | null }> {
    const tipo = pestaniaDe(datos.factura);
    const pestania = this.pestanias[tipo];
    if (!pestania) throw new PestaniaSinConfigurar(tipo);
    const valores = filaConOpcionales(datos, await this.leerEncabezados(pestania, tipo));
    const ultima = letraColumna(valores.length - 1);
    // OVERWRITE escribe en la primera fila vacía debajo de los datos, como cuando se carga a mano.
    // Las celdas en null (forma de pago, banco, retención...) no se tocan.
    const r = await this.client.request<{ updates?: { updatedRange?: string } }>({
      url: `${this.valores(this.rango(pestania, `A1:${ultima}1`))}:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE`,
      method: "POST",
      data: { values: [valores] },
    });
    const n = r.data.updates?.updatedRange?.match(/!A(\d+):/)?.[1];
    const fila = n ? Number(n) : null;
    lecturas.delete(this.claveLectura());

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
