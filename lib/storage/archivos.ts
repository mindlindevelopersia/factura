import type { Categoria, Factura } from "../invoice/schema";
import { formatNumero, formatTipo } from "../invoice/tipos";

export interface ArchivoParaGuardar {
  nombre: string;
  mediaType: string;
  data: Uint8Array;
  /** Cada categoría va a su carpeta: compras, honorarios o ventas. */
  carpeta: Categoria;
}

/** Dónde se guardan los PDF y las fotos. Devuelve el link para la planilla. */
export interface AlmacenArchivos {
  guardar(archivo: ArchivoParaGuardar): Promise<{ url: string }>;
}

/**
 * Guarda en Drive a través de un script de Apps Script publicado como web app
 * (apps-script/guardar-factura.gs). El script corre como la cuenta dueña de la
 * carpeta, así que no depende del espacio de la cuenta de servicio.
 */
export class AppsScriptAlmacen implements AlmacenArchivos {
  constructor(
    private readonly url: string,
    private readonly secreto: string,
  ) {}

  async guardar(archivo: ArchivoParaGuardar): Promise<{ url: string }> {
    // Apps Script responde con una redirección: fetch la sigue sola.
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: this.secreto,
        nombre: archivo.nombre,
        carpeta: archivo.carpeta,
        mimeType: archivo.mediaType,
        base64: Buffer.from(archivo.data).toString("base64"),
      }),
    });
    const texto = await res.text();
    let respuesta: { ok?: boolean; url?: string; error?: string };
    try {
      respuesta = JSON.parse(texto);
    } catch {
      throw new Error(`Apps Script respondió algo inesperado (HTTP ${res.status}): ${texto.slice(0, 200)}`);
    }
    if (!respuesta.ok || !respuesta.url) throw new Error(`Apps Script no guardó el archivo: ${respuesta.error ?? "sin detalle"}`);
    return { url: respuesta.url };
  }
}

/** El almacén configurado, o null si todavía no hay ninguno (las facturas se cargan sin link). */
export function almacenDesdeEnv(): AlmacenArchivos | null {
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
