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
import type { Candado, Candados } from "./candados";
import type { Cola } from "./hoja";
import type { ItemCola, Nota, Origen, Resultado } from "./item";

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
  /** Para que dos pedidos simultáneos no carguen lo mismo dos veces. Sin esto, no se traba nada. */
  candados?: Candados;
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

/** El mismo archivo está entrando en este momento por otro pedido (lo mandaron dos veces seguidas). */
export class ArchivoEnCurso extends ErrorCola {
  constructor() {
    super("Este archivo ya se está cargando: llegó dos veces seguidas. Queda una sola vez.", 409);
    this.name = "ArchivoEnCurso";
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
    case "aprobando":
      return `se está cargando en la planilla${item.resueltaPor ? ` (lo aprobó ${item.resueltaPor})` : ""}`;
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

/**
 * Una aprobación tarda unos segundos (la función corta a los 60). Pasado este tiempo sin
 * terminar, se la da por cortada y se puede retomar. Es también lo que dura su candado.
 */
export const APROBACION_COLGADA_MS = 2 * 60 * 1000;

/** Lo que dura el candado de un archivo que entra: guardarlo en Drive y anotarlo en la cola. */
const INGRESO_MS = 2 * 60 * 1000;

/**
 * Corre fn con los candados de esas claves tomados (ver candados.ts) y los suelta al final.
 * Si otro pedido tiene alguno, tira el error de ocupado sin correr nada.
 */
async function conCandados<T>(s: Servicios, claves: string[], duracionMs: number, ocupado: () => Error, fn: () => Promise<T>): Promise<T> {
  if (!s.candados) return fn();
  const tomados: Candado[] = [];
  try {
    for (const clave of claves) {
      const candado = await s.candados.tomar(clave, duracionMs);
      if (!candado) throw ocupado();
      tomados.push(candado);
    }
    return await fn();
  } finally {
    await Promise.all(tomados.map((c) => c.soltar().catch((e) => console.error("No se pudo soltar un candado", e))));
  }
}

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
 * ni leer nada; si está entrando en este mismo momento por otro pedido, ArchivoEnCurso.
 */
export async function ingresar(s: Servicios, entrada: Entrada): Promise<ItemCola> {
  const huella = huellaDe(entrada.archivo.data);
  const item = await conCandados(s, [`archivo:${huella}`], INGRESO_MS, () => new ArchivoEnCurso(), () => encolar(s, entrada, huella));
  return leer(s, item, entrada.archivo.data);
}

async function encolar(s: Servicios, entrada: Entrada, huella: string): Promise<ItemCola> {
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
  return item;
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
  aprobando: "Este comprobante se está cargando en la planilla.",
};

/** Una aprobación que está corriendo ahora (no una que se cortó o falló a mitad de camino). */
export function aprobacionEnCurso(item: ItemCola, momento: number): boolean {
  return item.estado === "aprobando" && !item.error && momento - Date.parse(item.resuelta ?? item.recibida) < APROBACION_COLGADA_MS;
}

function verificarAprobable(item: ItemCola, momento: number) {
  if (item.estado === "pendiente") return;
  if (item.estado === "aprobando" && !aprobacionEnCurso(item, momento)) return;
  if (item.estado === "aprobando") {
    throw new ErrorCola(`${item.resueltaPor ?? "Otra persona"} está aprobando este comprobante en este momento.`, 409);
  }
  throw new ErrorCola(YA[item.estado] ?? "Este comprobante no se puede aprobar.", 409);
}

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
 *
 * Para que nunca quede una fila de más:
 * - Toma un candado por comprobante y otro por factura (proveedor, tipo y número): si dos
 *   personas aprueban a la vez, o la misma factura en dos archivos, pasa una sola.
 * - Con el candado tomado, vuelve a leer el comprobante y la planilla (sin la lectura guardada).
 * - Antes de escribir en la planilla, deja el comprobante "aprobando". Si la función se corta
 *   o Sheets falla a mitad de camino, al volver a aprobar se busca la fila: si ya está, se
 *   completa la aprobación con esa fila en lugar de agregar otra.
 * - Mover el archivo es por su ID, así que repetirlo no duplica nada en Drive.
 */
export async function aprobar(s: Servicios, id: string, factura: Factura, usuario: string): Promise<ItemCola> {
  verificarAprobable(await buscar(s, id), ahora(s).getTime());
  const planilla = s.planilla;
  if (!planilla) throw new ErrorCola("Falta configurar la planilla en el servidor.", 503);
  const pestania = pestaniaDe(factura);
  if (!planilla.tiene(pestania)) {
    const variable = pestania === "ingresos" ? "SHEET_TAB_INGRESOS" : "SHEET_TAB_EGRESOS";
    throw new ErrorCola(`Falta configurar la pestaña de ${pestania === "ingresos" ? "ventas" : "compras"} (${variable}).`, 503);
  }

  const clave = claveDuplicado(factura);
  const claves = [`aprobar:${id}`, ...(clave ? [`factura:${clave}`] : [])];
  const ocupado = () => new ErrorCola("Otra persona está aprobando esta factura en este momento. Esperá unos segundos.", 409);
  return conCandados(s, claves, APROBACION_COLGADA_MS, ocupado, async () => {
    const item = await buscar(s, id);
    verificarAprobable(item, ahora(s).getTime());
    const retomada = item.estado === "aprobando";
    const nombreGenerico = pestania === "ingresos" ? "Ingresos" : "Egresos";

    const cargada = buscarCargada(await planilla.registros({ fresco: true }), factura);
    if (cargada?.tipo === "duplicada") {
      if (!retomada) throw new ErrorCola(`Esta factura ya está cargada en la planilla (fila ${cargada.fila}).`, 409);
      // La aprobación anterior llegó a escribir la fila: se completa con esa fila.
      return terminarAprobacion(s, item, factura, usuario, { pestania: item.resultado?.pestania ?? nombreGenerico, fila: cargada.fila, link: item.archivo.url });
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
    const enCurso: ItemCola = {
      ...item,
      estado: "aprobando",
      archivo: { ...item.archivo, url },
      notas,
      lectura: { factura, desde: item.lectura?.desde ?? null, fallback: item.lectura?.fallback ?? false },
      error: null,
      resuelta: fecha.toISOString(),
      resueltaPor: usuario,
      resultado: { pestania: nombreGenerico, fila: null, link: url },
    };
    await s.cola.guardar(enCurso);

    let agregada: { pestania: string; fila: number | null };
    try {
      agregada = await planilla.agregar({ factura, link: url, fechaRegistro: hoyEnBuenosAires(fecha) });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      const error = `No se pudo confirmar la carga en la planilla (${motivo}). Volvé a aprobar: si la fila llegó a escribirse, no se duplica.`;
      await s.cola.guardar({ ...enCurso, error }).catch((e2) => console.error(`No se pudo anotar el error de ${id}`, e2));
      throw new ErrorCola(error, 502);
    }
    return terminarAprobacion(s, enCurso, factura, usuario, { ...agregada, link: url });
  });
}

async function terminarAprobacion(s: Servicios, item: ItemCola, factura: Factura, usuario: string, resultado: Resultado): Promise<ItemCola> {
  const aprobado: ItemCola = {
    ...item,
    estado: "aprobada",
    lectura: { factura, desde: item.lectura?.desde ?? null, fallback: item.lectura?.fallback ?? false },
    error: null,
    resuelta: item.resuelta ?? ahora(s).toISOString(),
    resueltaPor: item.resueltaPor ?? usuario,
    resultado,
  };
  await s.cola.guardar(aprobado);
  await avisar(s, aprobado, "aprobada");
  return aprobado;
}

/** Descarta un comprobante: el archivo va a la papelera de Drive y queda en el historial. */
export async function descartar(s: Servicios, id: string, usuario: string): Promise<ItemCola> {
  const item = await buscar(s, id);
  if (item.estado === "aprobada" || item.estado === "descartada") throw new ErrorCola(YA[item.estado], 409);
  if (item.estado === "aprobando") {
    // El archivo ya puede estar en su carpeta y la fila en la planilla: descartarlo rompería el link.
    throw new ErrorCola("Este comprobante quedó a mitad de la aprobación. Volvé a aprobarlo para completarla: si la fila ya está en la planilla, no se duplica.", 409);
  }
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
    .filter((i) => i.estado === "pendiente" || i.estado === "error" || i.estado === "leyendo" || i.estado === "aprobando")
    .map((i): Pendiente => {
      const colgada = i.estado === "leyendo" && momento - Date.parse(i.recibida) > LECTURA_COLGADA_MS;
      const cortada = i.estado === "aprobando" && !i.error && !aprobacionEnCurso(i, momento);
      const item = colgada
        ? { ...i, estado: "error" as const, error: "La lectura no terminó. Reintentá." }
        : cortada
          ? { ...i, error: "La aprobación anterior no terminó. Volvé a aprobar para completarla: si la fila ya está en la planilla, no se duplica." }
          : i;
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
