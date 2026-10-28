import type { JWT } from "google-auth-library";
import { letraColumna } from "../sheets/columnas";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Una pestaña usada como tabla simple: encabezados en la fila 1 y una fila por registro,
 * todo escrito en modo RAW (nada se interpreta como fórmula). Si no existe, la crea.
 */
export class PestaniaSimple {
  private preparada: Promise<void> | null = null;
  private readonly ultima: string;

  constructor(
    private readonly client: JWT,
    private readonly sheetId: string,
    private readonly nombre: string,
    private readonly encabezados: readonly string[],
  ) {
    this.ultima = letraColumna(encabezados.length - 1);
  }

  private url(a1: string) {
    return `${SHEETS}/${this.sheetId}/values/${encodeURIComponent(`'${this.nombre.replace(/'/g, "''")}'!${a1}`)}`;
  }

  private preparar(): Promise<void> {
    this.preparada ??= (async () => {
      const r = await this.client.request<{ sheets: { properties: { title: string } }[] }>({
        url: `${SHEETS}/${this.sheetId}?fields=sheets.properties.title`,
      });
      if (!r.data.sheets.some((s) => s.properties.title === this.nombre)) {
        await this.client.request({
          url: `${SHEETS}/${this.sheetId}:batchUpdate`,
          method: "POST",
          data: { requests: [{ addSheet: { properties: { title: this.nombre, gridProperties: { frozenRowCount: 1 } } } }] },
        });
      }
      const fila1 = await this.client.request<{ values?: string[][] }>({ url: this.url(`A1:${this.ultima}1`) });
      if (!fila1.data.values?.[0]?.some((v) => v !== "")) {
        await this.client.request({
          url: `${this.url(`A1:${this.ultima}1`)}?valueInputOption=RAW`,
          method: "PUT",
          data: { values: [[...this.encabezados]] },
        });
      }
    })().catch((e) => {
      this.preparada = null;
      throw e;
    });
    return this.preparada;
  }

  /** Las filas de datos, desde la 2. El índice i corresponde a la fila i + 2. */
  async filas(): Promise<string[][]> {
    await this.preparar();
    const r = await this.client.request<{ values?: string[][] }>({ url: this.url(`A2:${this.ultima}`) });
    return r.data.values ?? [];
  }

  async agregar(valores: string[]): Promise<void> {
    await this.preparar();
    await this.client.request({
      url: `${this.url(`A1:${this.ultima}1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      method: "POST",
      data: { values: [valores] },
    });
  }

  async escribir(fila: number, valores: string[]): Promise<void> {
    await this.preparar();
    await this.client.request({
      url: `${this.url(`A${fila}:${this.ultima}${fila}`)}?valueInputOption=RAW`,
      method: "PUT",
      data: { values: [valores] },
    });
  }
}
