import type { PestaniaSimple } from "../google/pestania";

export const COLUMNAS_USUARIOS_TELEGRAM = ["ID de Telegram", "Usuario", "Email", "Conectado"] as const;

/**
 * Qué cuenta de Telegram corresponde a qué mail habilitado. Vive en una pestaña de la
 * planilla de la cola. El bot solo acepta comprobantes de cuentas conectadas a un mail que
 * siga en ALLOWED_EMAILS: sacar un mail de la lista también le corta el bot.
 */
export class UsuariosTelegram {
  constructor(
    private readonly pestania: PestaniaSimple,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async emailDe(telegramId: number): Promise<string | null> {
    const fila = (await this.pestania.filas()).find((f) => f[0] === String(telegramId));
    return fila?.[2]?.trim() || null;
  }

  async telegramDe(email: string): Promise<string | null> {
    const buscado = email.trim().toLowerCase();
    const fila = (await this.pestania.filas()).find((f) => (f[2] ?? "").trim().toLowerCase() === buscado);
    return fila ? fila[1] || fila[0] : null;
  }

  /** Conecta (o reconecta a otro mail) una cuenta de Telegram. */
  async vincular(telegramId: number, usuario: string, email: string): Promise<void> {
    const valores = [String(telegramId), usuario, email, this.ahora().toISOString()];
    const i = (await this.pestania.filas()).findIndex((f) => f[0] === String(telegramId));
    if (i >= 0) await this.pestania.escribir(i + 2, valores);
    else await this.pestania.agregar(valores);
  }
}
