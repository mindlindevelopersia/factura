import { randomUUID } from "node:crypto";
import type { PestaniaSimple } from "../google/pestania";

/** Un candado tomado. soltar() lo libera antes de que venza; si no se llama, vence solo. */
export interface Candado {
  soltar(): Promise<void>;
}

/**
 * Exclusión mutua entre funciones del servidor (en Vercel cada pedido puede correr en otra
 * máquina, así que no alcanza con una variable en memoria). Sirve para que dos personas que
 * aprueban la misma factura a la vez, o la misma foto mandada dos veces seguidas, no terminen
 * en dos filas.
 */
export interface Candados {
  /** Toma el candado de esa clave por un tiempo. null si ya lo tiene otro. */
  tomar(clave: string, duracionMs: number): Promise<Candado | null>;
}

export const COLUMNAS_CANDADOS = ["Clave", "Token", "Tomado", "Vence"] as const;
const LIBERADO = "liberado";

/**
 * Los candados en una pestaña de la planilla de la cola. Cada intento agrega una fila y
 * después lee la pestaña: gana la primera fila vigente de esa clave. Sheets aplica los
 * agregados de a uno y en orden, así que de dos intentos simultáneos gana exactamente uno,
 * sin depender de quién lee primero. El que pierde marca su fila como liberada para no
 * trabar a los que vienen después.
 */
export class CandadosSheets implements Candados {
  constructor(
    private readonly pestania: Pick<PestaniaSimple, "agregar" | "filas" | "escribir">,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async tomar(clave: string, duracionMs: number): Promise<Candado | null> {
    const token = randomUUID();
    const desde = this.ahora();
    const valores = [clave, token, desde.toISOString(), new Date(desde.getTime() + duracionMs).toISOString()];
    const fila = await this.pestania.agregar(valores);
    const momento = this.ahora().getTime();
    const primera = (await this.pestania.filas()).find((f) => f[0] === clave && Date.parse(f[3] ?? "") > momento);
    const soltar = async () => {
      if (fila) await this.pestania.escribir(fila, [clave, token, valores[2], LIBERADO]);
    };
    if (primera?.[1] === token) return { soltar };
    await soltar().catch((e) => console.error(`No se pudo liberar el intento de candado ${clave}`, e));
    return null;
  }
}

/** Para los tests y el desarrollo local: la misma regla, en memoria. */
export class CandadosMemoria implements Candados {
  private readonly tomados = new Map<string, { token: string; vence: number }>();

  constructor(private readonly ahora: () => Date = () => new Date()) {}

  async tomar(clave: string, duracionMs: number): Promise<Candado | null> {
    const momento = this.ahora().getTime();
    const actual = this.tomados.get(clave);
    if (actual && actual.vence > momento) return null;
    const token = randomUUID();
    this.tomados.set(clave, { token, vence: momento + duracionMs });
    return {
      soltar: async () => {
        if (this.tomados.get(clave)?.token === token) this.tomados.delete(clave);
      },
    };
  }
}
