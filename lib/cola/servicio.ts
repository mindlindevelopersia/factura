import Anthropic from "@anthropic-ai/sdk";
import { completarFactura } from "../invoice/completar";
import { ExtractionError, type ExtractionResult, type InvoiceFile } from "../invoice/extract";
import type { Factura } from "../invoice/schema";
import { pestaniaDe } from "../sheets/columnas";
import type { Planilla } from "../sheets/planilla";
import { buscarCargada, type Coincidencia, type Registros } from "../sheets/registros";
import { nombreArchivo, subcarpetaDe, type Almacen, type ArchivoNuevo } from "../storage/archivos";
import type { Cola } from "./hoja";
import type { ItemCola, Origen } from "./item";

export type Aviso = "leida" | "error" | "aprobada" | "descartada";

/** Todo lo que usa la cola. En producción, serviciosDesdeEnv (lib/cola/env.ts); en los tests, dobles. */
export interface Servicios {
  cola: Cola;
  almacen: Almacen;
  /** null si la planilla no está configurada: se puede leer igual, sin historial ni duplicados. */
  planilla: Planilla | null;
  extraer: (archivo: InvoiceFile) => Promise<ExtractionResult>;
  /** Le avisa al que mandó el comprobante (hoy, por Telegram). */
  avisar?: (item: ItemCola, aviso: Aviso, extra: { duplicado: boolean }) => Promise<void>;
  ahora?: () => Date;
}

/** Un error para mostrar tal cual, con el código HTTP que corresponde. */
export class ErrorCola extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ErrorCola";
  }
}

/** Si la lectura no terminó en este tiempo, la función se cortó: se muestra como error para reintentar. */
export const LECTURA_COLGADA_MS = 3 * 60 * 1000;

const ahora = (s: Servicios) => (s.ahora ?? (() => new Date()))();

export function hoyEnBuenosAires(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(fecha);
}

function mensajeDeError(e: unknown): string {
  if (e instanceof ExtractionError) return e.message;
  if (e instanceof Anthropic.RateLimitError) return "Demasiadas facturas a la vez. Esperá un minuto y reintentá.";
  if (e instanceof Anthropic.APIError) return `El servicio de IA falló (${e.status ?? "sin código"}). Reintentá en un rato.`;
  return e instanceof Error ? e.message : String(e);
}

async function avisar(s: Servicios, item: ItemCola, aviso: Aviso, duplicado = false) {
  try {
    await s.avisar?.(item, aviso, { duplicado });
  } catch (e) {
    // Un aviso que no sale no frena la carga.
    console.error(`No se pudo avisar "${aviso}" de ${item.id}`, e);
  }
}

async function registros(planilla: Planilla | null): Promise<Registros | null> {
  if (!planilla) return null;
  try {
    return await planilla.registros();
  } catch (e) {
    console.error("No se pudo leer la planilla", e);
    return null;
  }
}

export interface Entrada {
  archivo: ArchivoNuevo;
  origen: Origen;
  enviadaPor: string;
  telegram?: ItemCola["telegram"];
}

/**
 * Lo que hace cualquier comprobante al llegar, por la web o por Telegram: se guarda en la
 * carpeta de pendientes (así no se pierde aunque falle la lectura), entra en la cola y se
 * lee con la IA.
 */
export async function ingresar(s: Servicios, entrada: Entrada): Promise<ItemCola> {
  const guardado = await s.almacen.guardarPendiente(entrada.archivo);
  const item: ItemCola = {
    id: crypto.randomUUID(),
    recibida: ahora(s).toISOString(),
    origen: entrada.origen,
    enviadaPor: entrada.enviadaPor,
    archivo: { nombre: entrada.archivo.nombre, mediaType: entrada.archivo.mediaType, driveId: guardado.id, url: guardado.url },
    estado: "leyendo",
    lectura: null,
    error: null,
    resuelta: null,
    resueltaPor: null,
    resultado: null,
    telegram: entrada.telegram ?? null,
  };
  await s.cola.agregar(item);
  return leer(s, item, entrada.archivo.data);
}

/** Lee (o vuelve a leer) un comprobante de la cola: IA, categoría e historial. */
export async function leer(s: Servicios, item: ItemCola, data?: Uint8Array): Promise<ItemCola> {
  let leido: ItemCola;
  let duplicado = false;
  try {
    const contenido = data ?? (await s.almacen.leer(item.archivo.driveId)).data;
    const [r, previos] = await Promise.all([
      s.extraer({ name: item.archivo.nombre, mediaType: item.archivo.mediaType, data: contenido }),
      registros(s.planilla),
    ]);
    const { factura, desde } = completarFactura(r.invoice, previos?.historial ?? null);
    duplicado = buscarCargada(previos, factura)?.tipo === "duplicada";
    leido = { ...item, estado: "pendiente", lectura: { factura, desde, fallback: r.fallback }, error: null };
  } catch (e) {
    console.error(`No se pudo leer ${item.archivo.nombre}`, e);
    leido = { ...item, estado: "error", error: mensajeDeError(e) };
  }
  await s.cola.guardar(leido);
  await avisar(s, leido, leido.estado === "pendiente" ? "leida" : "error", duplicado);
  return leido;
}

async function buscar(s: Servicios, id: string): Promise<ItemCola> {
  const item = await s.cola.obtener(id);
  if (!item) throw new ErrorCola("Ese comprobante no está en la cola.", 404);
  return item;
}

const YA: Record<string, string> = {
  aprobada: "Este comprobante ya fue aprobado y cargado.",
  descartada: "Este comprobante ya fue descartado.",
  leyendo: "La IA todavía está leyendo este comprobante.",
};

/** Vuelve a leer un comprobante que dio error (o que se quiere releer). */
export async function reintentar(s: Servicios, id: string): Promise<ItemCola> {
  const item = await buscar(s, id);
  const colgada = item.estado === "leyendo" && Date.now() - Date.parse(item.recibida) > LECTURA_COLGADA_MS;
  if (item.estado !== "error" && item.estado !== "pendiente" && !colgada) throw new ErrorCola(YA[item.estado], 409);
  return leer(s, item);
}

/**
 * Aprueba un comprobante con los datos que revisó la persona: controla duplicados contra la
 * planilla, mueve el archivo a la subcarpeta del mes de su categoría y agrega la fila.
 * Si algo falla a mitad de camino, el comprobante sigue pendiente y se puede volver a
 * aprobar: el archivo se mueve por su ID, así que repetir no duplica nada en Drive.
 */
export async function aprobar(s: Servicios, id: string, factura: Factura, usuario: string): Promise<ItemCola> {
  const item = await buscar(s, id);
  if (item.estado !== "pendiente") throw new ErrorCola(YA[item.estado] ?? "Este comprobante no se puede aprobar.", 409);
  if (!s.planilla) throw new ErrorCola("Falta configurar la planilla en el servidor.", 503);
  const pestania = pestaniaDe(factura);
  if (!s.planilla.tiene(pestania)) {
    const variable = pestania === "ingresos" ? "SHEET_TAB_INGRESOS" : "SHEET_TAB_EGRESOS";
    throw new ErrorCola(`Falta configurar la pestaña de ${pestania === "ingresos" ? "ventas" : "compras"} (${variable}).`, 503);
  }

  const cargada = buscarCargada(await s.planilla.registros(), factura);
  if (cargada?.tipo === "duplicada") {
    throw new ErrorCola(`Esta factura ya está cargada en la planilla (fila ${cargada.fila}).`, 409);
  }

  const { url } = await s.almacen.archivar(item.archivo.driveId, {
    carpeta: factura.categoria,
    subcarpeta: subcarpetaDe(factura),
    nombre: nombreArchivo(factura, item.archivo.mediaType),
  });
  const fecha = ahora(s);
  const { pestania: nombrePestania, fila } = await s.planilla.agregar({ factura, link: url, fechaRegistro: hoyEnBuenosAires(fecha) });

  const aprobado: ItemCola = {
    ...item,
    estado: "aprobada",
    archivo: { ...item.archivo, url },
    lectura: { factura, desde: item.lectura?.desde ?? null, fallback: item.lectura?.fallback ?? false },
    error: null,
    resuelta: fecha.toISOString(),
    resueltaPor: usuario,
    resultado: { pestania: nombrePestania, fila, link: url },
  };
  await s.cola.guardar(aprobado);
  await avisar(s, aprobado, "aprobada");
  return aprobado;
}

/** Descarta un comprobante: el archivo va a la papelera de Drive y queda en el historial. */
export async function descartar(s: Servicios, id: string, usuario: string): Promise<ItemCola> {
  const item = await buscar(s, id);
  if (item.estado === "aprobada" || item.estado === "descartada") throw new ErrorCola(YA[item.estado], 409);
  await s.almacen.descartar(item.archivo.driveId);
  const descartado: ItemCola = { ...item, estado: "descartada", resuelta: ahora(s).toISOString(), resueltaPor: usuario };
  await s.cola.guardar(descartado);
  await avisar(s, descartado, "descartada");
  return descartado;
}

export interface Pendiente extends ItemCola {
  /** Si la factura ya está en la planilla (cargada a mano o por otra persona), o su número. */
  cargada: Coincidencia | null;
}

/** Para la web: lo que espera revisión, de lo más viejo a lo más nuevo, y el historial, de lo más nuevo a lo más viejo. */
export async function listar(s: Servicios, limiteHistorial = 100): Promise<{ pendientes: Pendiente[]; historial: ItemCola[] }> {
  const [items, previos] = await Promise.all([s.cola.listar(), registros(s.planilla)]);
  const momento = ahora(s).getTime();
  const pendientes = items
    .filter((i) => i.estado === "pendiente" || i.estado === "error" || i.estado === "leyendo")
    .map((i): Pendiente => {
      const colgada = i.estado === "leyendo" && momento - Date.parse(i.recibida) > LECTURA_COLGADA_MS;
      const item = colgada ? { ...i, estado: "error" as const, error: "La lectura no terminó. Reintentá." } : i;
      return { ...item, cargada: item.lectura ? buscarCargada(previos, item.lectura.factura) : null };
    })
    .sort((a, b) => a.recibida.localeCompare(b.recibida));
  const historial = items
    .filter((i) => i.estado === "aprobada" || i.estado === "descartada")
    .sort((a, b) => (b.resuelta ?? b.recibida).localeCompare(a.resuelta ?? a.recibida))
    .slice(0, limiteHistorial);
  return { pendientes, historial };
}
