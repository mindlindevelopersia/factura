import type { PestaniaSimple } from "../google/pestania";
import { aFilaCola, deFilaCola, type ItemCola } from "./item";

/** Dónde se guarda la cola. */
export interface Cola {
  listar(): Promise<ItemCola[]>;
  obtener(id: string): Promise<ItemCola | null>;
  agregar(item: ItemCola): Promise<void>;
  guardar(item: ItemCola): Promise<void>;
}

/**
 * La cola en una pestaña de una planilla aparte (COLA_SHEET_ID), no en Administración
 * Contable: ahí solo van las facturas aprobadas. Con 20 a 25 comprobantes por mes, leerla
 * entera en cada consulta alcanza.
 */
export class ColaSheets implements Cola {
  constructor(private readonly pestania: PestaniaSimple) {}

  private async filas(): Promise<{ item: ItemCola; fila: number }[]> {
    return (await this.pestania.filas()).flatMap((valores, i) => {
      const item = deFilaCola(valores);
      return item ? [{ item, fila: i + 2 }] : [];
    });
  }

  async listar(): Promise<ItemCola[]> {
    return (await this.filas()).map((f) => f.item);
  }

  async obtener(id: string): Promise<ItemCola | null> {
    return (await this.filas()).find((f) => f.item.id === id)?.item ?? null;
  }

  async agregar(item: ItemCola): Promise<void> {
    await this.pestania.agregar(aFilaCola(item));
  }

  async guardar(item: ItemCola): Promise<void> {
    const encontrada = (await this.filas()).find((f) => f.item.id === item.id);
    if (!encontrada) throw new Error(`No está en la cola: ${item.id}`);
    await this.pestania.escribir(encontrada.fila, aFilaCola(item));
  }
}
