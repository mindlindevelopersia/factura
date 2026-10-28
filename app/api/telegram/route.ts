import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { faltantesCola, respuestaDeError, usuariosTelegramDesdeEnv } from "@/lib/cola/env";
import { BOT_TELEGRAM, TelegramApi, tokenTelegram } from "@/lib/telegram/api";
import { codigoVinculo } from "@/lib/telegram/mensajes";

function webhookDe(req: Request): string {
  return `${new URL(req.url).origin}/api/telegram-webhook`;
}

/**
 * Estado del bot para la web: si está activo (el webhook apunta a esta app), si el usuario
 * ya conectó su Telegram y el link para conectarlo.
 */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const token = tokenTelegram();
  if (!token) return NextResponse.json({ configurado: false });
  try {
    const info = await new TelegramApi(token).infoWebhook();
    // Sin la planilla de la cola no hay dónde guardar las cuentas conectadas: se muestra igual el estado del bot.
    const conectadoComo = faltantesCola().length === 0 ? await usuariosTelegramDesdeEnv().telegramDe(user.email) : null;
    return NextResponse.json({
      configurado: true,
      bot: BOT_TELEGRAM,
      activo: info.url === webhookDe(req),
      webhook: info.url || null,
      ultimoError: info.last_error_message ?? null,
      conectadoComo,
      linkConectar: `https://t.me/${BOT_TELEGRAM}?start=${codigoVinculo(user.email, process.env.AUTH_SECRET ?? "")}`,
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}

/** Activa el bot: le dice a Telegram que mande los mensajes a esta app. Se puede repetir. */
export async function POST(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const token = tokenTelegram();
  if (!token) return NextResponse.json({ error: "Falta configurar TELEGRAM_API_KEY en el servidor." }, { status: 503 });
  try {
    await new TelegramApi(token).configurarWebhook(webhookDe(req));
    return NextResponse.json({ ok: true, webhook: webhookDe(req) });
  } catch (e) {
    return respuestaDeError(e);
  }
}
