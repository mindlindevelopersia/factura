import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { completarFactura } from "../invoice/completar";
import { ExtractionError, type ExtractionResult, type InvoiceFile } from "../invoice/extract";
import type { Factura } from "../invoice/schema";
import { claveDuplicado } from "../invoice/tipos";
import { pestaniaDe } from "../sheets/columnas";
import type { Planilla } from "../sheets/planilla";
import { buscarCargada, TOLERANCIA_DUPLICADO, type Coincidencia, type Registros } from "../sheets/registros";
import { nombreArchivo, subcarpetaDe, type Almacen, type ArchivoNuevo } from "../storage/archivos";
import type { Cola } from "./hoja";
import type { ItemCola, Nota, Origen } from "./item";

export type Aviso = "leida" | "error" | "aprobada" | "descartada";

export interface ExtraAviso {
  /** Ya está cargada en la planilla. */
  duplicado: boolean;
  /** El mismo comprobante ya está en la cola (mandado antes, quizás en otro archivo). */
  repetida: ItemCola | null;
}

/** Todo lo que usa la cola. En producción, serviciosDesdeEnv (lib/cola/env.ts); en los tests, dobles. */
export interface Servicios {
  cola: Cola;
  almacen: Almacen;
  /** null si la planilla no está configurada: se puede leer igual, sin historial ni duplicados. */
  planilla: Planilla | null;
  /** comentario: lo que escribió quien lo mandó, como contexto para la IA. */
  extraer: (archivo: InvoiceFile, contexto?: { comentario?: string }) => Promise<ExtractionResult>;
  /** Le avisa al que mandó el comprobante (hoy, por Telegram). */
  avisar?: (item: ItemCola, aviso: Aviso, extra: ExtraAviso) => Promise<void>;
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

/** El mismo archivo ya está en la cola: no se guarda ni se lee de nuevo. */
export class ArchivoRepetido extends ErrorCola {
  constructor(readonly existente: ItemCola) {
    super(`Este archivo ya está en la cola: ${descripcionEstado(existente)}.`, 409);
    this.name = "ArchivoRepetido";
  }
}

/** "llegó el 29/10 14:32 y está para revisar", "ya está cargado en la fila 230"... */
export function descripcionEstado(item: ItemCola): string {
  const cuando = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(item.recibida));
  const quien = item.enviadaPor ? ` (lo mandó ${item.enviadaPor})` : "";
  switch (item.estado) {
    case "aprobada":
      return `ya está cargado${item.resultado?.fila ? ` en la fila ${item.resultado.fila}` : ""}${quien}`;
    case "descartada":
      return `se descartó${quien}`;
    case "error":
      return `llegó el ${cuando}${quien} y no se pudo leer; se puede reintentar desde la web`;
    default:
      return `llegó el ${cuando}${quien} y está para revisar`;
  }
}

/** Mismo comprobante: misma clave (proveedor, tipo, punto de venta y número) y mismo total (±$1). */
export function mismoComprobante(a: Factura, b: Factura): boolean {
  const clave = claveDuplicado(a);
  return !!clave && clave === claveDuplicado(b) && Math.abs(Math.abs(a.total) - Math.abs(b.total)) <= TOLERANCIA_DUPLICADO;
}

/** Otro comprobante de la cola (no descartado) que es el mismo que este. */
export function repetidaEnCola(items: ItemCola[], item: ItemCola, factura: Factura): ItemCola | null {
  return (
    items.find((i) => i.id !== item.id && i.estado !== "descartada" && i.lectura && mismoComprobante(i.lectura.factura, factura)) ??
    null
  );
}

export function huellaDe(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
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

async function avisar(s: Servicios, item: ItemCola, aviso: Aviso, extra: ExtraAviso = { duplicado: false, repetida: null }) {
  try {
    await s.avisar?.(item, aviso, extra);
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
  /** El texto que acompañó al archivo (en Telegram, el pie de la foto o del documento). */
  comentario?: string;
}

/**
 * Lo que hace cualquier comprobante al llegar, por la web o por Telegram: se guarda en la
 * carpeta de pendientes (así no se pierde aunque falle la lectura), entra en la cola y se
 * lee con la IA. Si el mismo archivo ya está en la cola, tira ArchivoRepetido sin guardar
 * ni leer nada.
 */
export async function ingresar(s: Servicios, entrada: Entrada): Promise<ItemCola> {
  const huella = huellaDe(entrada.archivo.data);
  const existente = (await s.cola.listar()).find((i) => i.huella === huella && i.estado !== "descartada");
  if (existente) throw new ArchivoRepetido(existente);

  const guardado = await s.almacen.guardarPendiente(entrada.archivo);
  const recibida = ahora(s).toISOString();
  const comentario = entrada.comentario?.trim();
  const item: ItemCola = {
    id: crypto.randomUUID(),
    recibida,
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
    huella,
    notas: comentario ? [{ tipo: "texto", texto: comentario, de: entrada.enviadaPor, fecha: recibida }] : [],
  };
  await s.cola.agregar(item);
  return leer(s, item, entrada.archivo.data);
}

/** Los comentarios de texto, para pasárselos a la IA. */
function comentarios(item: ItemCola): string | undefined {
  const textos = item.notas.filter((n) => n.tipo === "texto" && n.texto).map((n) => n.texto!.trim());
  return textos.length ? textos.join("\n") : undefined;
}

/** Lee (o vuelve a leer) un comprobante de la cola: IA, categoría e historial. */
export async function leer(s: Servicios, item: ItemCola, data?: Uint8Array): Promise<ItemCola> {
  let leido: ItemCola;
  const extra: ExtraAviso = { duplicado: false, repetida: null };
  try {
    const contenido = data ?? (await s.almacen.leer(item.archivo.driveId)).data;
    const [r, previos, enCola] = await Promise.all([
      s.extraer({ name: item.archivo.nombre, mediaType: item.archivo.mediaType, data: contenido }, { comentario: comentarios(item) }),
      registros(s.planilla),
      s.cola.listar(),
    ]);
    const { factura, desde } = completarFactura(r.invoice, previos?.historial ?? null);
    extra.duplicado = buscarCargada(previos, factura)?.tipo === "duplicada";
    extra.repetida = repetidaEnCola(enCola, item, factura);
    leido = { ...item, estado: "pendiente", lectura: { factura, desde, fallback: r.fallback }, error: null };
  } catch (e) {
    console.error(`No se pudo leer ${item.archivo.nombre}`, e);
    leido = { ...item, estado: "error", error: mensajeDeError(e) };
  }
  // Mientras la IA leía pudo llegar un comentario: se conservan los que haya ahora.
  const actual = await s.cola.obtener(item.id);
  // Otra persona pudo resolverlo mientras la IA respondía. Nunca se vuelve a abrir
  // un comprobante aprobado o descartado por una lectura que terminó más tarde.
  if (actual?.estado === "aprobada" || actual?.estado === "descartada") return actual;
  if (actual) leido = { ...leido, notas: actual.notas };
  await s.cola.guardar(leido);
  await avisar(s, leido, leido.estado === "pendiente" ? "leida" : "error", extra);
  return leido;
}

/**
 * Agrega un comentario a un comprobante de la cola. Si es un audio y el comprobante ya está
 * aprobado, el audio va directo a la carpeta del comprobante; si fue descartado, a la papelera.
 */
export async function agregarNota(s: Servicios, id: string, nota: Nota): Promise<ItemCola> {
  const item = await buscar(s, id);
  let guardada = nota;
  if (nota.audio && item.estado === "aprobada" && item.lectura) {
    const f = item.lectura.factura;
    const base = nombreArchivo(f, item.archivo.mediaType).replace(/\.[^.]+$/, "");
    const extension = nota.audio.nombre.match(/\.[^.]+$/)?.[0] ?? "";
    const { url } = await s.almacen.archivar(nota.audio.driveId, {
      carpeta: f.categoria,
      subcarpeta: subcarpetaDe(f),
      nombre: `${base} - comentario ${item.notas.length + 1}${extension}`,
    });
    guardada = { ...nota, audio: { ...nota.audio, url } };
  } else if (nota.audio && item.estado === "descartada") {
    await s.almacen.descartar(nota.audio.driveId);
  }
  const conNota = { ...item, notas: [...item.notas, guardada] };
  await s.cola.guardar(conNota);
  return conNota;
}

/** Cuánto tiempo después de mandar una factura se toma un mensaje como comentario de esa factura. */
export const VENTANA_COMENTARIO_MS = 30 * 60 * 1000;

/** El último comprobante que mandó un chat de Telegram, si fue hace poco. La cola está en orden de llegada. */
export async function ultimoDelChat(s: Servicios, chat: number): Promise<ItemCola | null> {
  const momento = ahora(s).getTime();
  const delChat = (await s.cola.listar()).filter(
    (i) => i.telegram?.chat === chat && momento - Date.parse(i.recibida) <= VENTANA_COMENTARIO_MS,
  );
  return delChat.at(-1) ?? null;
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

  const subcarpeta = subcarpetaDe(factura);
  const nombre = nombreArchivo(factura, item.archivo.mediaType);
  const { url } = await s.almacen.archivar(item.archivo.driveId, { carpeta: factura.categoria, subcarpeta, nombre });
  // Los audios van al lado del comprobante, con el mismo nombre: "... - comentario 1.ogg".
  const base = nombre.replace(/\.[^.]+$/, "");
  const notas = await Promise.all(
    item.notas.map(async (n, i): Promise<Nota> => {
      if (n.tipo !== "audio" || !n.audio) return n;
      const extension = n.audio.nombre.match(/\.[^.]+$/)?.[0] ?? "";
      const archivada = await s.almacen.archivar(n.audio.driveId, { carpeta: factura.categoria, subcarpeta, nombre: `${base} - comentario ${i + 1}${extension}` });
      return { ...n, audio: { ...n.audio, url: archivada.url } };
    }),
  );
  const fecha = ahora(s);
  const { pestania: nombrePestania, fila } = await s.planilla.agregar({ factura, link: url, fechaRegistro: hoyEnBuenosAires(fecha) });

  const aprobado: ItemCola = {
    ...item,
    estado: "aprobada",
    archivo: { ...item.archivo, url },
    notas,
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
  for (const n of item.notas) if (n.audio) await s.almacen.descartar(n.audio.driveId);
  const descartado: ItemCola = { ...item, estado: "descartada", resuelta: ahora(s).toISOString(), resueltaPor: usuario };
  await s.cola.guardar(descartado);
  await avisar(s, descartado, "descartada");
  return descartado;
}

export interface Pendiente extends ItemCola {
  /** Si la factura ya está en la planilla (cargada a mano o por otra persona), o su número. */
  cargada: Coincidencia | null;
  /** El mismo comprobante, mandado antes y todavía en la cola (o ya aprobado desde la cola). */
  repetida: { id: string; estado: ItemCola["estado"]; descripcion: string } | null;
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
      const otra = item.lectura ? repetidaEnCola(items, item, item.lectura.factura) : null;
      // De dos repetidas pendientes, se marca la que llegó después (la cola está en orden de llegada).
      const repetida = otra && (otra.estado === "aprobada" || items.indexOf(otra) < items.findIndex((x) => x.id === item.id)) ? otra : null;
      return {
        ...item,
        cargada: item.lectura ? buscarCargada(previos, item.lectura.factura) : null,
        repetida: repetida ? { id: repetida.id, estado: repetida.estado, descripcion: descripcionEstado(repetida) } : null,
      };
    })
    .sort((a, b) => a.recibida.localeCompare(b.recibida));
  const historial = items
    .filter((i) => i.estado === "aprobada" || i.estado === "descartada")
    .sort((a, b) => (b.resuelta ?? b.recibida).localeCompare(a.resuelta ?? a.recibida))
    .slice(0, limiteHistorial);
  return { pendientes, historial };
}
