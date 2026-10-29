import type { Categoria, Factura } from "../invoice/schema";
import { formatNumero, formatTipo } from "../invoice/tipos";

export interface ArchivoNuevo {
  nombre: string;
  mediaType: string;
  data: Uint8Array;
}

export interface ArchivoGuardado {
  id: string;
  url: string;
}

/** Destino final de un comprobante aprobado: la carpeta de su categoría y la subcarpeta del mes. */
export interface Destino {
  carpeta: Categoria;
  subcarpeta: string;
  nombre: string;
}

/**
 * Dónde viven los PDF y las fotos. Al llegar, cada archivo va a la carpeta de pendientes;
 * al aprobarlo, se mueve a la carpeta de su categoría, dentro de la subcarpeta del mes, con
 * el nombre estándar. El mismo archivo (mismo ID) pasa de una carpeta a otra.
 */
export interface Almacen {
  guardarPendiente(archivo: ArchivoNuevo): Promise<ArchivoGuardado>;
  leer(id: string): Promise<ArchivoNuevo>;
  archivar(id: string, destino: Destino): Promise<{ url: string }>;
  descartar(id: string): Promise<void>;
}

/** Versión del script que entiende las acciones de abajo (apps-script/guardar-factura.gs). */
export const VERSION_SCRIPT = 2;

export class ScriptDesactualizado extends Error {
  constructor() {
    super("El script de Apps Script es de una versión anterior: falta publicar la versión nueva (apps-script/README.md).");
    this.name = "ScriptDesactualizado";
  }
}

/**
 * Drive a través de un script de Apps Script publicado como web app (apps-script/). El
 * script corre como la cuenta dueña de las carpetas, así que no depende del espacio de la
 * cuenta de servicio.
 */
export class AppsScriptAlmacen implements Almacen {
  constructor(
    private readonly url: string,
    private readonly secreto: string,
  ) {}

  private async llamar<T>(accion: string, datos: object): Promise<T> {
    // Apps Script responde con una redirección: fetch la sigue sola.
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: this.secreto, accion, ...datos }),
    });
    const texto = await res.text();
    let respuesta: { ok?: boolean; error?: string; version?: number } & T;
    try {
      respuesta = JSON.parse(texto);
    } catch {
      throw new Error(`Apps Script respondió algo inesperado (HTTP ${res.status}): ${texto.slice(0, 200)}`);
    }
    if (!respuesta.ok) throw new Error(`Apps Script: ${respuesta.error ?? "sin detalle"}`);
    if ((respuesta.version ?? 1) < VERSION_SCRIPT) throw new ScriptDesactualizado();
    return respuesta;
  }

  async guardarPendiente(archivo: ArchivoNuevo): Promise<ArchivoGuardado> {
    const r = await this.llamar<{ id: string; url: string }>("guardar", {
      carpeta: "pendientes",
      nombre: archivo.nombre,
      mimeType: archivo.mediaType,
      base64: Buffer.from(archivo.data).toString("base64"),
    });
    return { id: r.id, url: r.url };
  }

  async leer(id: string): Promise<ArchivoNuevo> {
    const r = await this.llamar<{ nombre: string; mimeType: string; base64: string }>("leer", { id });
    return { nombre: r.nombre, mediaType: r.mimeType, data: new Uint8Array(Buffer.from(r.base64, "base64")) };
  }

  async archivar(id: string, destino: Destino): Promise<{ url: string }> {
    const r = await this.llamar<{ url: string }>("archivar", { id, ...destino });
    return { url: r.url };
  }

  async descartar(id: string): Promise<void> {
    await this.llamar("descartar", { id });
  }

  /**
   * Los links a las carpetas de Drive configuradas en el script, por categoría. Los devuelve
   * el script desde la versión 3; con uno anterior, un objeto vacío.
   */
  async carpetas(): Promise<Partial<Record<Categoria | "pendientes", string>>> {
    const r = await this.llamar<{ enlaces?: Partial<Record<Categoria | "pendientes", string>> }>("version", {});
    return r.enlaces ?? {};
  }
}

/** El almacén configurado, o null si faltan APPS_SCRIPT_URL y APPS_SCRIPT_SECRET. */
export function almacenDesdeEnv(): AppsScriptAlmacen | null {
  const url = process.env.APPS_SCRIPT_URL;
  const secreto = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secreto) return null;
  return new AppsScriptAlmacen(url, secreto);
}

const EXTENSIONES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Nombre estándar: "2026-09-15 Corralon Ejemplo SA - Factura A 00003-00001234.pdf". En las
 * ventas va el cliente en lugar del emisor, que siempre es Mindlin.
 */
export function nombreArchivo(f: Factura, mediaType: string): string {
  const contraparte = f.categoria === "venta" ? (f.cliente ?? f.razon_social_receptor ?? "") : f.razon_social;
  const partes = [f.fecha_factura, contraparte, "-", formatTipo(f), formatNumero(f) ?? ""];
  const base = partes
    .join(" ")
    .replace(/[\\/:*?"<>|\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  return `${base}.${EXTENSIONES[mediaType] ?? "bin"}`;
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const NOMBRE_CATEGORIA: Record<Categoria, string> = { compra: "Compras", honorarios: "Honorarios", venta: "Ventas" };

/**
 * Subcarpeta del mes de la factura, como las arma el equipo ("Facturas Compras Octubre"),
 * con el año para que no se mezclen los octubres: "Facturas Compras Octubre 2026".
 */
export function subcarpetaDe(f: Pick<Factura, "categoria" | "fecha_factura">): string {
  const m = f.fecha_factura.match(/^(\d{4})-(\d{2})/);
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  const periodo = m && mes ? `${mes} ${m[1]}` : "Sin fecha";
  return `Facturas ${NOMBRE_CATEGORIA[f.categoria]} ${periodo}`;
}
