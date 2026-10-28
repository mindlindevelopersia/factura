import { FacturaSchema, type Factura } from "../invoice/schema";
import { formatNumero, formatTipo } from "../invoice/tipos";

/**
 * Estado de un comprobante en la cola:
 * - leyendo: llegó y la IA lo está leyendo.
 * - pendiente: leído, espera que alguien lo revise y lo apruebe.
 * - error: no se pudo leer; se puede reintentar.
 * - aprobada: cargado en la planilla y archivado en su carpeta.
 * - descartada: alguien lo descartó; el archivo fue a la papelera.
 */
export const ESTADOS = ["leyendo", "pendiente", "error", "aprobada", "descartada"] as const;
export type EstadoCola = (typeof ESTADOS)[number];

export type Origen = "web" | "telegram";

export interface Lectura {
  factura: Factura;
  /** Fila de la carga anterior de la misma contraparte, de la que se tomaron datos. */
  desde: { pestania: "egresos" | "ingresos"; fila: number } | null;
  fallback: boolean;
}

export interface Resultado {
  pestania: string;
  fila: number | null;
  link: string | null;
}

export interface ItemCola {
  id: string;
  recibida: string;
  origen: Origen;
  enviadaPor: string;
  archivo: { nombre: string; mediaType: string; driveId: string; url: string };
  estado: EstadoCola;
  lectura: Lectura | null;
  error: string | null;
  resuelta: string | null;
  resueltaPor: string | null;
  resultado: Resultado | null;
  /** Mensaje de Telegram con el que llegó, para contestarle al que lo mandó. */
  telegram: { chat: number; mensaje: number } | null;
}

/**
 * Columnas de la pestaña de la cola. Contraparte, comprobante y total están para que el
 * equipo pueda leer la cola en la planilla; la app usa la lectura completa, en JSON.
 */
export const COLUMNAS_COLA = [
  "ID",
  "Recibida",
  "Origen",
  "Enviada por",
  "Archivo",
  "Tipo de archivo",
  "ID en Drive",
  "Link en Drive",
  "Estado",
  "Contraparte",
  "Comprobante",
  "Total",
  "Lectura (JSON)",
  "Error",
  "Resuelta",
  "Resuelta por",
  "Resultado (JSON)",
  "Telegram",
] as const;

export function contraparte(f: Factura): string {
  return (f.categoria === "venta" ? (f.cliente ?? f.razon_social_receptor) : f.razon_social) ?? "";
}

export function comprobante(f: Factura): string {
  return [formatTipo(f), formatNumero(f)].filter(Boolean).join(" ");
}

/** La fila de la cola. Se escribe en modo RAW: nada se interpreta como fórmula. */
export function aFilaCola(item: ItemCola): string[] {
  const f = item.lectura?.factura;
  return [
    item.id,
    item.recibida,
    item.origen,
    item.enviadaPor,
    item.archivo.nombre,
    item.archivo.mediaType,
    item.archivo.driveId,
    item.archivo.url,
    item.estado,
    f ? contraparte(f) : "",
    f ? comprobante(f) : "",
    f ? String(f.total) : "",
    item.lectura ? JSON.stringify(item.lectura) : "",
    item.error ?? "",
    item.resuelta ?? "",
    item.resueltaPor ?? "",
    item.resultado ? JSON.stringify(item.resultado) : "",
    item.telegram ? `${item.telegram.chat}:${item.telegram.mensaje}` : "",
  ];
}

function json<T>(s: string | undefined, validar: (v: unknown) => T | null): T | null {
  if (!s) return null;
  try {
    return validar(JSON.parse(s));
  } catch {
    return null;
  }
}

/** Lee una fila de la cola. Devuelve null si no tiene ID (una fila vacía o editada a mano). */
export function deFilaCola(fila: string[]): ItemCola | null {
  const c = (i: number) => (fila[i] ?? "").trim();
  if (!c(0)) return null;
  const estado = (ESTADOS as readonly string[]).includes(c(8)) ? (c(8) as EstadoCola) : "error";
  const lectura = json<Lectura>(c(12), (v) => {
    const l = v as Partial<Lectura>;
    const factura = FacturaSchema.safeParse(l?.factura);
    return factura.success ? { factura: factura.data, desde: l.desde ?? null, fallback: l.fallback === true } : null;
  });
  const [chat, mensaje] = c(17).split(":").map(Number);
  return {
    id: c(0),
    recibida: c(1),
    origen: c(2) === "telegram" ? "telegram" : "web",
    enviadaPor: c(3),
    archivo: { nombre: c(4), mediaType: c(5), driveId: c(6), url: c(7) },
    estado,
    lectura,
    error: c(13) || null,
    resuelta: c(14) || null,
    resueltaPor: c(15) || null,
    resultado: json<Resultado>(c(16), (v) => v as Resultado),
    telegram: Number.isFinite(chat) && Number.isFinite(mensaje) && c(17) ? { chat, mensaje } : null,
  };
}
