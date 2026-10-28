import { createHash } from "node:crypto";

/** Nombre del bot, para los links de vinculación. */
export const BOT_TELEGRAM = "mindlindevelopers_factura_bot";

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
}

export interface InfoWebhook {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

/** Lo justo de la API de bots de Telegram. */
export class TelegramApi {
  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async llamar<T>(metodo: string, datos: object = {}): Promise<T> {
    const res = await this.fetchFn(`https://api.telegram.org/bot${this.token}/${metodo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    const r = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!r.ok) throw new Error(`Telegram ${metodo}: ${r.description ?? res.status}`);
    return r.result as T;
  }

  async enviar(chat: number, texto: string, responderA?: number): Promise<void> {
    await this.llamar("sendMessage", {
      chat_id: chat,
      text: texto,
      link_preview_options: { is_disabled: true },
      ...(responderA ? { reply_parameters: { message_id: responderA, allow_sending_without_reply: true } } : {}),
    });
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
}
