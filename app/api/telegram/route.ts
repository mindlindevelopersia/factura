import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { faltantesCola, respuestaDeError, usuariosTelegramDesdeEnv } from "@/lib/cola/env";
import { TelegramApi, tokenTelegram } from "@/lib/telegram/api";
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
    const telegram = new TelegramApi(token);
    const [info, bot] = await Promise.all([telegram.infoWebhook(), telegram.yo()]);
    // Sin la planilla de la cola no hay dónde guardar las cuentas conectadas: se muestra igual el estado del bot.
    const conectados = faltantesCola().length === 0 ? await usuariosTelegramDesdeEnv().telegramsDe(user.email) : [];
    return NextResponse.json({
      configurado: true,
      bot: bot.username,
      activo: info.url === webhookDe(req),
      webhook: info.url || null,
      ultimoError: info.last_error_message ?? null,
      conectados,
      linkConectar: `https://t.me/${bot.username}?start=${codigoVinculo(user.email, process.env.AUTH_SECRET ?? "")}`,
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}

/**
 * POST sin cuerpo: activa el bot (le dice a Telegram que mande los mensajes a esta app; se
 * puede repetir). POST { desconectar: <id de Telegram> }: desconecta una cuenta del usuario.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const cuerpo = (await req.json().catch(() => null)) as { desconectar?: number } | null;
  if (cuerpo?.desconectar) {
    try {
      const ok = await usuariosTelegramDesdeEnv().desvincular(Number(cuerpo.desconectar), user.email);
      if (!ok) return NextResponse.json({ error: "Esa cuenta de Telegram no está conectada a tu mail." }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return respuestaDeError(e);
    }
  }
  const token = tokenTelegram();
  if (!token) return NextResponse.json({ error: "Falta configurar TELEGRAM_API_KEY en el servidor." }, { status: 503 });
  try {
    await new TelegramApi(token).configurarWebhook(webhookDe(req));
    return NextResponse.json({ ok: true, webhook: webhookDe(req) });
  } catch (e) {
    return respuestaDeError(e);
  }
}
