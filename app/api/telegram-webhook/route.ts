import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowed";
import { candadosDesdeEnv, serviciosDesdeEnv, usuariosTelegramDesdeEnv } from "@/lib/cola/env";
import { agregarNota, ArchivoEnCurso, ArchivoRepetido, ingresar, ultimoDelChat } from "@/lib/cola/servicio";
import { secretoWebhook, TelegramApi, tokenTelegram, type MensajeTelegram } from "@/lib/telegram/api";
import { adjuntoDe, audioDe, emailDeCodigo, nombreDe, TEXTOS } from "@/lib/telegram/mensajes";

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
 *
 * - Un PDF o una foto: entra en la cola. El texto que lo acompaña queda como comentario y la
 *   IA lo usa de contexto.
 * - Un texto o un audio: se anota como comentario en la última factura que mandó ese chat en
 *   la última media hora. Los audios se guardan en Drive junto a la factura.
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
    if (!email || !isAllowedEmail(email)) return (await responder(TEXTOS.noVinculado(appUrl)), ok());

    const s = serviciosDesdeEnv(appUrl);
    const de = `${nombreDe(m)} (${email})`;
    const fecha = new Date().toISOString();

    const adjunto = adjuntoDe(m);
    if (adjunto && "error" in adjunto) return (await responder(adjunto.error), ok());
    if (!adjunto) {
      // Un comentario suelto: texto o audio, para la última factura de este chat.
      const audio = audioDe(m);
      const texto = m.text?.trim();
      if (!audio && (!texto || texto.startsWith("/"))) return (await responder(TEXTOS.ayuda), ok());
      if (audio && "error" in audio) return (await responder(audio.error), ok());
      const ultima = await ultimoDelChat(s, m.chat.id);
      if (!ultima) return (await responder(TEXTOS.sinFacturaParaNota), ok());
      if (audio) {
        const data = await telegram.bajar(audio.fileId);
        const guardado = await s.almacen.guardarPendiente({ nombre: audio.nombre, mediaType: audio.mediaType, data });
        const nota = { tipo: "audio" as const, audio: { ...guardado, driveId: guardado.id, mediaType: audio.mediaType, nombre: audio.nombre }, de, fecha };
        const conNota = await agregarNota(s, ultima.id, nota);
        return (await responder(TEXTOS.notaAgregada(conNota)), ok());
      }
      const conNota = await agregarNota(s, ultima.id, { tipo: "texto", texto, de, fecha });
      return (await responder(TEXTOS.notaAgregada(conNota)), ok());
    }

    // Si Telegram reintenta el mismo mensaje (por ejemplo, porque esta función tardó), no se
    // carga dos veces. El candado no se suelta: vence a los dos días, cuando Telegram ya no reintenta.
    const candado = await candadosDesdeEnv().tomar(`telegram:${m.chat.id}:${m.message_id}`, 48 * 60 * 60 * 1000);
    if (!candado) return ok();

    await Promise.all([
      responder(TEXTOS.recibida),
      telegram.reaccionar(m.chat.id, m.message_id, "👀").catch((e) => console.error("No se pudo reaccionar en Telegram", e)),
    ]);
    after(async () => {
      // "escribiendo…" mientras se baja, se guarda y se lee: unos 10 a 40 segundos.
      const parar = telegram.escribiendo(m.chat.id);
      try {
        const data = await telegram.bajar(adjunto.fileId);
        // ingresar avisa por Telegram cuando termina de leer (o si no pudo).
        await ingresar(s, {
          archivo: { nombre: adjunto.nombre, mediaType: adjunto.mediaType, data },
          origen: "telegram",
          enviadaPor: de,
          telegram: { chat: m.chat.id, mensaje: m.message_id },
          comentario: m.caption,
        });
      } catch (e) {
        await telegram.reaccionar(m.chat.id, m.message_id, "🤔").catch(() => {});
        if (e instanceof ArchivoRepetido) {
          await responder(TEXTOS.repetida(e.existente)).catch(() => {});
          return;
        }
        if (e instanceof ArchivoEnCurso) {
          await responder(TEXTOS.enCurso).catch(() => {});
          return;
        }
        console.error("No se pudo ingresar el comprobante de Telegram", e);
        await responder(TEXTOS.noGuardada(e instanceof Error ? e.message : String(e))).catch(() => {});
      } finally {
        parar();
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
