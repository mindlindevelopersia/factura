import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowed";
import { serviciosDesdeEnv, usuariosTelegramDesdeEnv } from "@/lib/cola/env";
import { ingresar } from "@/lib/cola/servicio";
import { secretoWebhook, TelegramApi, tokenTelegram, type MensajeTelegram } from "@/lib/telegram/api";
import { adjuntoDe, emailDeCodigo, nombreDe, TEXTOS } from "@/lib/telegram/mensajes";

// Bajar el archivo, guardarlo y leerlo con la IA sigue después de contestarle a Telegram.
export const maxDuration = 120;

const ok = () => NextResponse.json({ ok: true });

function secretoValido(recibido: string | null, token: string): boolean {
  const esperado = Buffer.from(secretoWebhook(token));
  const dado = Buffer.from(recibido ?? "");
  return dado.length === esperado.length && timingSafeEqual(dado, esperado);
}

/** Habilitados: los mails de ALLOWED_EMAILS. */
function emailsHabilitados(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Webhook del bot. Solo atiende chats privados de cuentas conectadas a un mail habilitado.
 * A las demás les contesta cómo conectarse y no guarda nada de lo que mandaron.
 */
export async function POST(req: Request) {
  const token = tokenTelegram();
  if (!token) return NextResponse.json({ error: "Bot sin configurar." }, { status: 404 });
  if (!secretoValido(req.headers.get("x-telegram-bot-api-secret-token"), token)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as { message?: MensajeTelegram } | null;
  const m = update?.message;
  if (!m?.from || m.chat.type !== "private") return ok();

  const telegram = new TelegramApi(token);
  const responder = (texto: string) => telegram.enviar(m.chat.id, texto, m.message_id);
  const appUrl = new URL(req.url).origin;

  try {
    const usuarios = usuariosTelegramDesdeEnv();
    const inicio = m.text?.match(/^\/start(?:\s+(\S+))?/);
    if (inicio?.[1]) {
      const email = emailDeCodigo(inicio[1], emailsHabilitados(), process.env.AUTH_SECRET ?? "");
      if (!email) return (await responder(TEXTOS.codigoInvalido), ok());
      await usuarios.vincular(m.from.id, nombreDe(m), email);
      return (await responder(TEXTOS.vinculado(email)), ok());
    }

    const email = await usuarios.emailDe(m.from.id);
    if (!email || !isAllowedEmail(email)) return (await responder(TEXTOS.noVinculado), ok());

    const adjunto = adjuntoDe(m);
    if (!adjunto) return (await responder(TEXTOS.ayuda), ok());
    if ("error" in adjunto) return (await responder(adjunto.error), ok());

    const s = serviciosDesdeEnv(appUrl);
    // Si Telegram reintenta el mismo mensaje, no se carga dos veces.
    const repetido = (await s.cola.listar()).some((i) => i.telegram?.chat === m.chat.id && i.telegram?.mensaje === m.message_id);
    if (repetido) return ok();

    await responder(TEXTOS.recibida);
    after(async () => {
      try {
        const data = await telegram.bajar(adjunto.fileId);
        // ingresar avisa por Telegram cuando termina de leer (o si no pudo).
        await ingresar(s, {
          archivo: { nombre: adjunto.nombre, mediaType: adjunto.mediaType, data },
          origen: "telegram",
          enviadaPor: `${nombreDe(m)} (${email})`,
          telegram: { chat: m.chat.id, mensaje: m.message_id },
        });
      } catch (e) {
        console.error("No se pudo ingresar el comprobante de Telegram", e);
        await responder(TEXTOS.noGuardada(e instanceof Error ? e.message : String(e))).catch(() => {});
      }
    });
    return ok();
  } catch (e) {
    console.error("Error en el webhook de Telegram", e);
    await responder(TEXTOS.noGuardada(e instanceof Error ? e.message : String(e))).catch(() => {});
    // 200 igual: si no, Telegram reintenta el mismo mensaje una y otra vez.
    return ok();
  }
}
