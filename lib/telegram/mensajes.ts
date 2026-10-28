import { createHmac, timingSafeEqual } from "node:crypto";
import { comprobante, contraparte, type ItemCola } from "../cola/item";
import { descripcionEstado, type ExtraAviso } from "../cola/servicio";
import type { MensajeTelegram } from "./api";

/** Telegram deja bajar hasta 20 MB a los bots. */
export const TAMANIO_MAXIMO_TELEGRAM = 20_000_000;
/** La API de Claude acepta imágenes de hasta 5 MB. */
export const IMAGEN_MAXIMA = 5_000_000;

const ACEPTADOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type Adjunto = { fileId: string; nombre: string; mediaType: string } | { error: string };

/** El comprobante que vino en el mensaje: un documento (PDF o imagen) o una foto. null si no trae nada. */
export function adjuntoDe(m: MensajeTelegram): Adjunto | null {
  if (m.document) {
    const tipo = m.document.mime_type ?? "";
    if (!ACEPTADOS[tipo]) return { error: `No puedo leer archivos ${tipo || "de ese tipo"}. Mandame la factura en PDF o como foto.` };
    if ((m.document.file_size ?? 0) > TAMANIO_MAXIMO_TELEGRAM) return { error: "El archivo pesa más de 20 MB." };
    if (tipo !== "application/pdf" && (m.document.file_size ?? 0) > IMAGEN_MAXIMA) {
      return { error: "La imagen pesa más de 5 MB. Mandala como foto (no como archivo) o en PDF." };
    }
    return { fileId: m.document.file_id, nombre: m.document.file_name ?? `factura-${m.message_id}.${ACEPTADOS[tipo]}`, mediaType: tipo };
  }
  if (m.photo?.length) {
    // Telegram manda la misma foto en varios tamaños: la más grande que se pueda bajar.
    const foto = [...m.photo]
      .filter((p) => (p.file_size ?? 0) <= TAMANIO_MAXIMO_TELEGRAM)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!foto) return { error: "La foto pesa más de 20 MB." };
    return { fileId: foto.file_id, nombre: `foto-${m.message_id}.jpg`, mediaType: "image/jpeg" };
  }
  return null;
}

const EXTENSIONES_AUDIO: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

/** Un audio (nota de voz o archivo de audio) que comenta un comprobante. null si el mensaje no trae audio. */
export function audioDe(m: MensajeTelegram): Adjunto | null {
  const a = m.voice ?? m.audio;
  if (!a) return null;
  if ((a.file_size ?? 0) > TAMANIO_MAXIMO_TELEGRAM) return { error: "El audio pesa más de 20 MB." };
  const mediaType = a.mime_type ?? "audio/ogg";
  const nombre = m.audio?.file_name ?? `audio-${m.message_id}.${EXTENSIONES_AUDIO[mediaType] ?? "ogg"}`;
  return { fileId: a.file_id, nombre, mediaType };
}

/** Cómo se muestra quién mandó el mensaje: "@usuario" o el nombre. */
export function nombreDe(m: MensajeTelegram): string {
  const f = m.from;
  if (!f) return "Telegram";
  return f.username ? `@${f.username}` : [f.first_name, f.last_name].filter(Boolean).join(" ") || String(f.id);
}

/**
 * Código para vincular una cuenta de Telegram a un mail habilitado. Va en el link
 * t.me/<bot>?start=<código> que muestra la web; Telegram lo manda al bot como "/start <código>".
 * Es una firma del mail con AUTH_SECRET: no hace falta guardarlo en ningún lado.
 */
export function codigoVinculo(email: string, secreto: string): string {
  return createHmac("sha256", secreto).update(`telegram:${email.trim().toLowerCase()}`).digest("base64url").slice(0, 32);
}

/** El mail habilitado al que corresponde un código, o null. */
export function emailDeCodigo(codigo: string, emails: readonly string[], secreto: string): string | null {
  const recibido = Buffer.from(codigo);
  for (const email of emails) {
    const esperado = Buffer.from(codigoVinculo(email, secreto));
    if (esperado.length === recibido.length && timingSafeEqual(esperado, recibido)) return email.trim().toLowerCase();
  }
  return null;
}

const pesos = (n: number, moneda: string) =>
  `${moneda === "ARS" ? "$" : `${moneda} `}${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const TEXTOS = {
  ayuda: "Mandame las facturas en PDF o como foto, una por mensaje. Las leo y quedan para revisar en la web.",
  noVinculado:
    "Todavía no conectaste tu Telegram. Entrá a la web de facturas con tu mail, tocá \"Conectar Telegram\" y volvé acá.",
  codigoInvalido: "Ese link de conexión no sirve. Generá uno nuevo desde la web de facturas.",
  vinculado: (email: string) => `Listo, este Telegram quedó conectado a ${email}. Ya podés mandarme facturas.`,
  recibida: "Recibida. La estoy leyendo…",
  noGuardada: (motivo: string) => `No pude guardar la factura: ${motivo}`,
  repetida: (existente: ItemCola) => `Esta factura ya la tengo: ${descripcionEstado(existente)}. No la cargo de nuevo.`,
  notaAgregada: (item: ItemCola) => `Anotado en ${resumen(item)}.`,
  sinFacturaParaNota:
    "No tengo una factura tuya de la última media hora para anotarle esto. Mandá primero la factura y después el comentario, o escribilo como texto de la foto o del archivo.",
};

function resumen(item: ItemCola): string {
  const f = item.lectura?.factura;
  if (!f) return item.archivo.nombre;
  return [contraparte(f), comprobante(f), pesos(f.total, f.moneda)].filter(Boolean).join(" · ");
}

/** El aviso al que mandó el comprobante, según cómo terminó. */
export function textoAviso(
  item: ItemCola,
  aviso: "leida" | "error" | "aprobada" | "descartada",
  appUrl: string,
  extra: ExtraAviso = { duplicado: false, repetida: null },
): string {
  const link = `${appUrl}/?revisar=${item.id}`;
  switch (aviso) {
    case "leida":
      return [
        `Leída: ${resumen(item)}.`,
        extra.duplicado ? "Ojo: parece que ya está cargada en la planilla." : null,
        !extra.duplicado && extra.repetida ? `Ojo: esta factura ya la habían mandado: ${descripcionEstado(extra.repetida)}.` : null,
        `Quedó para revisar: ${link}`,
      ]
        .filter(Boolean)
        .join("\n");
    case "error":
      return `No pude leer ${item.archivo.nombre}: ${item.error ?? "error desconocido"}. Quedó guardada; se puede reintentar desde la web: ${link}`;
    case "aprobada": {
      const r = item.resultado;
      return `Cargada en la planilla: ${resumen(item)}${r?.fila ? ` (${r.pestania}, fila ${r.fila})` : ""}.`;
    }
    case "descartada":
      return `Descartada: ${resumen(item)}.`;
  }
}
