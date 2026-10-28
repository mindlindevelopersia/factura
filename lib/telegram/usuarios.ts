import type { PestaniaSimple } from "../google/pestania";

export const COLUMNAS_USUARIOS_TELEGRAM = ["ID de Telegram", "Usuario", "Email", "Conectado"] as const;

export interface CuentaTelegram {
  id: number;
  usuario: string;
  /** Cuándo se conectó, ISO. */
  conectado: string;
}

/**
 * Qué cuenta de Telegram corresponde a qué mail habilitado. Vive en una pestaña de la
 * planilla de la cola. Una cuenta de Telegram va a un solo mail; un mail puede tener varias.
 * El bot solo acepta comprobantes de cuentas conectadas a un mail que siga en ALLOWED_EMAILS:
 * sacar un mail de la lista también le corta el bot.
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

  /** Las cuentas de Telegram conectadas a un mail. Una persona puede tener varias (dos teléfonos con cuentas distintas). */
  async telegramsDe(email: string): Promise<CuentaTelegram[]> {
    const buscado = email.trim().toLowerCase();
    return (await this.pestania.filas())
      .filter((f) => f[0] && (f[2] ?? "").trim().toLowerCase() === buscado)
      .map((f) => ({ id: Number(f[0]), usuario: f[1] || f[0], conectado: f[3] ?? "" }));
  }

  /** Desconecta una cuenta de Telegram, solo si está conectada a ese mail. Devuelve false si no lo estaba. */
  async desvincular(telegramId: number, email: string): Promise<boolean> {
    const filas = await this.pestania.filas();
    const i = filas.findIndex((f) => f[0] === String(telegramId) && (f[2] ?? "").trim().toLowerCase() === email.trim().toLowerCase());
    if (i < 0) return false;
    await this.pestania.escribir(i + 2, ["", "", "", ""]);
    return true;
  }

  /** Conecta (o reconecta a otro mail) una cuenta de Telegram. */
  async vincular(telegramId: number, usuario: string, email: string): Promise<void> {
    const valores = [String(telegramId), usuario, email, this.ahora().toISOString()];
    const i = (await this.pestania.filas()).findIndex((f) => f[0] === String(telegramId));
    if (i >= 0) await this.pestania.escribir(i + 2, valores);
    else await this.pestania.agregar(valores);
  }
}
