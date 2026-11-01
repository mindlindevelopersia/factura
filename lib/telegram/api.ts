import { createHash } from "node:crypto";

/** El token del bot (en Vercel, TELEGRAM_API_KEY), o null si no está. */
export function tokenTelegram(): string | null {
  return process.env.TELEGRAM_API_KEY || process.env.TELEGRAM_BOT_TOKEN || null;
}

/**
 * Secreto que Telegram manda en cada llamada al webhook (X-Telegram-Bot-Api-Secret-Token).
 * Sale del token, así no hace falta otra variable: quien no tiene el token no lo puede armar.
 */
export function secretoWebhook(token: string): string {
  return createHash("sha256").update(`webhook:${token}`).digest("hex");
}

export interface MensajeTelegram {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; username?: string; first_name?: string; last_name?: string };
  text?: string;
  caption?: string;
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  photo?: { file_id: string; width: number; height: number; file_size?: number }[];
  /** Nota de voz. */
  voice?: { file_id: string; mime_type?: string; file_size?: number; duration?: number };
  /** Archivo de audio. */
  audio?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number; duration?: number };
}

export interface InfoWebhook {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

/** Reacciones que un bot puede poner (Telegram acepta solo algunas). */
export type Reaccion = "👀" | "👌" | "🤔" | "👍" | null;

/** Métodos que se pueden repetir sin efectos de más si falla la red o Telegram. */
const IDEMPOTENTES = new Set(["getFile", "getMe", "getWebhookInfo", "setWebhook", "setMessageReaction", "sendChatAction"]);
const ESPERAS_MS = [1000, 3000];

/** El usuario del bot no cambia: se pide una vez por token. */
const bots = new Map<string, Promise<{ username: string; first_name: string }>>();

/** Los botones de respuesta: de a dos por fila (de a uno si son largos). */
export function tecladoDe(opciones: string[]): { text: string }[][] {
  const filas: { text: string }[][] = [];
  for (const o of opciones) {
    const ultima = filas.at(-1);
    if (ultima && ultima.length < 2 && o.length <= 18 && ultima[0].text.length <= 18) ultima.push({ text: o });
    else filas.push([{ text: o }]);
  }
  return filas;
}

/** Lo justo de la API de bots de Telegram. */
export class TelegramApi {
  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /**
   * Llama a un método de la API. Si Telegram pide esperar (429, demasiados mensajes), espera lo
   * que dice y repite: el mensaje no salió. Un corte de red o un 5xx se repite solo en los
   * métodos idempotentes, para no mandar un aviso dos veces.
   */
  private async llamar<T>(metodo: string, datos: object = {}): Promise<T> {
    for (let intento = 0; ; intento++) {
      let res: Response;
      try {
        res = await this.fetchFn(`https://api.telegram.org/bot${this.token}/${metodo}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(datos),
        });
      } catch (e) {
        if (intento < ESPERAS_MS.length && IDEMPOTENTES.has(metodo)) {
          await this.esperar(ESPERAS_MS[intento]);
          continue;
        }
        throw e;
      }
      const r = (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as {
        ok: boolean;
        result?: T;
        description?: string;
        parameters?: { retry_after?: number };
      };
      if (r.ok) return r.result as T;
      const espera = res.status === 429 ? Math.min((r.parameters?.retry_after ?? 1) * 1000, 10_000) : res.status >= 500 && IDEMPOTENTES.has(metodo) ? ESPERAS_MS[intento] : undefined;
      if (espera !== undefined && intento < ESPERAS_MS.length) {
        await this.esperar(espera);
        continue;
      }
      throw new Error(`Telegram ${metodo}: ${r.description ?? res.status}`);
    }
  }

  /** Se puede reemplazar en los tests. */
  esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /** Manda un mensaje. Con `opciones`, abajo aparecen botones que, al tocarlos, mandan ese texto. */
  async enviar(chat: number, texto: string, responderA?: number, opciones?: string[]): Promise<void> {
    await this.llamar("sendMessage", {
      chat_id: chat,
      text: texto,
      link_preview_options: { is_disabled: true },
      ...(responderA ? { reply_parameters: { message_id: responderA, allow_sending_without_reply: true } } : {}),
      ...(opciones?.length ? { reply_markup: { keyboard: tecladoDe(opciones), one_time_keyboard: true, resize_keyboard: true } } : {}),
    });
  }

  /** Pone (o saca, con null) una reacción sobre un mensaje: la señal de en qué quedó la factura. */
  async reaccionar(chat: number, mensaje: number, reaccion: Reaccion): Promise<void> {
    await this.llamar("setMessageReaction", { chat_id: chat, message_id: mensaje, reaction: reaccion ? [{ type: "emoji", emoji: reaccion }] : [] });
  }

  /**
   * Muestra "escribiendo…" en el chat mientras la IA lee. Telegram lo muestra 5 segundos: se
   * repite hasta que se llama a la función que devuelve.
   */
  escribiendo(chat: number): () => void {
    const mandar = () => this.llamar("sendChatAction", { chat_id: chat, action: "typing" }).catch(() => {});
    void mandar();
    const intervalo = setInterval(mandar, 4500);
    return () => clearInterval(intervalo);
  }

  /** Baja un archivo que mandaron al bot (hasta 20 MB, el límite de Telegram para bots). */
  async bajar(fileId: string): Promise<Uint8Array> {
    const { file_path } = await this.llamar<{ file_path?: string }>("getFile", { file_id: fileId });
    if (!file_path) throw new Error("Telegram no devolvió el archivo.");
    const res = await this.fetchFn(`https://api.telegram.org/file/bot${this.token}/${file_path}`);
    if (!res.ok) throw new Error(`No se pudo bajar el archivo de Telegram (HTTP ${res.status}).`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async configurarWebhook(url: string): Promise<void> {
    await this.llamar("setWebhook", { url, secret_token: secretoWebhook(this.token), allowed_updates: ["message"] });
  }

  infoWebhook(): Promise<InfoWebhook> {
    return this.llamar<InfoWebhook>("getWebhookInfo");
  }

  /** El bot: su nombre de usuario (para los links t.me/...) sale de acá, no se escribe a mano. */
  yo(): Promise<{ username: string; first_name: string }> {
    let bot = bots.get(this.token);
    if (!bot) {
      bot = this.llamar<{ username: string; first_name: string }>("getMe");
      bots.set(this.token, bot);
      bot.catch(() => bots.delete(this.token));
    }
    return bot;
  }
}
