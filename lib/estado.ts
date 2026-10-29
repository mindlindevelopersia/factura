import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { faltantesCola } from "./cola/env";
import { googleClient } from "./google/auth";
import { MODEL } from "./invoice/extract";
import { TelegramApi, tokenTelegram } from "./telegram/api";

/** Una pieza de la configuración y si está lista. */
export interface Chequeo {
  titulo: string;
  ok: boolean;
  detalle: string;
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

async function conTiempo<T>(promesa: Promise<T>, ms = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    timer = setTimeout(() => rechazar(new Error("no respondió a tiempo")), ms);
  });
  try {
    return await Promise.race([promesa, limite]);
  } finally {
    clearTimeout(timer);
  }
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function anthropic(): Promise<Chequeo> {
  const titulo = "IA (Anthropic)";
  if (!process.env.ANTHROPIC_API_KEY) return { titulo, ok: false, detalle: "Falta ANTHROPIC_API_KEY en Vercel." };
  try {
    await conTiempo(new Anthropic().models.retrieve(MODEL));
    return { titulo, ok: true, detalle: `La clave funciona y tiene acceso a ${MODEL}.` };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { titulo, ok: false, detalle: "ANTHROPIC_API_KEY está cargada pero no es válida." };
    return { titulo, ok: false, detalle: `No se pudo verificar la clave: ${mensaje(e)}` };
  }
}

/** Los nombres de las pestañas de una planilla, o el motivo por el que no se pudo leer. */
async function pestanias(sheetId: string): Promise<string[]> {
  const client = googleClient();
  if (!client) throw new Error("falta la cuenta de servicio");
  const r = await conTiempo(
    client.request<{ sheets: { properties: { title: string } }[] }>({ url: `${SHEETS}/${sheetId}?fields=sheets.properties.title` }),
  );
  return r.data.sheets.map((s) => s.properties.title);
}

function errorDeGoogle(e: unknown): string {
  const status = (e as { response?: { status?: number } }).response?.status;
  if (status === 403) return "la cuenta de servicio no tiene acceso: hay que compartirla con ella como Editor";
  if (status === 404) return "no existe una planilla con ese ID";
  return mensaje(e);
}

async function planillas(): Promise<Chequeo[]> {
  const chequeos: Chequeo[] = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return [{ titulo: "Cuenta de servicio de Google", ok: false, detalle: "Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY." }];
  }

  const sheetId = process.env.SHEET_ID;
  const egresos = process.env.SHEET_TAB_EGRESOS || process.env.SHEET_TAB || "Hoja 1";
  const ingresos = process.env.SHEET_TAB_INGRESOS;
  if (!sheetId) {
    chequeos.push({ titulo: "Planilla Administración Contable", ok: false, detalle: "Falta SHEET_ID." });
  } else {
    try {
      const titulos = await pestanias(sheetId);
      const lista = `Pestañas de la planilla: ${titulos.map((t) => `"${t}"`).join(", ")}.`;
      chequeos.push({ titulo: "Planilla Administración Contable", ok: true, detalle: "La cuenta de servicio la puede leer." });
      chequeos.push(
        titulos.includes(egresos)
          ? { titulo: "Pestaña de compras y honorarios", ok: true, detalle: `"${egresos}".` }
          : { titulo: "Pestaña de compras y honorarios", ok: false, detalle: `No hay una pestaña "${egresos}" (SHEET_TAB_EGRESOS). ${lista}` },
      );
      chequeos.push(
        !ingresos
          ? { titulo: "Pestaña de ventas", ok: false, detalle: `Falta SHEET_TAB_INGRESOS. ${lista}` }
          : titulos.includes(ingresos)
            ? { titulo: "Pestaña de ventas", ok: true, detalle: `"${ingresos}".` }
            : { titulo: "Pestaña de ventas", ok: false, detalle: `No hay una pestaña "${ingresos}" (SHEET_TAB_INGRESOS). ${lista}` },
      );
    } catch (e) {
      chequeos.push({ titulo: "Planilla Administración Contable", ok: false, detalle: `SHEET_ID: ${errorDeGoogle(e)}.` });
    }
  }

  const colaId = process.env.COLA_SHEET_ID;
  if (!colaId) {
    chequeos.push({
      titulo: "Planilla de la cola",
      ok: false,
      detalle: "Falta COLA_SHEET_ID: una planilla vacía aparte, compartida con la cuenta de servicio como Editor.",
    });
  } else {
    try {
      await pestanias(colaId);
      chequeos.push({ titulo: "Planilla de la cola", ok: true, detalle: "La cuenta de servicio la puede usar." });
    } catch (e) {
      chequeos.push({ titulo: "Planilla de la cola", ok: false, detalle: `COLA_SHEET_ID: ${errorDeGoogle(e)}.` });
    }
  }
  return chequeos;
}

const CARPETAS: Record<string, string> = {
  pendientes: "Pendientes",
  compra: "Compras",
  honorarios: "Honorarios",
  venta: "Ventas",
};

async function drive(): Promise<Chequeo> {
  const titulo = "Drive (script de Apps Script)";
  const url = process.env.APPS_SCRIPT_URL;
  const secreto = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secreto) return { titulo, ok: false, detalle: "Faltan APPS_SCRIPT_URL y APPS_SCRIPT_SECRET." };
  try {
    const res = await conTiempo(
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: secreto, accion: "version" }) }),
    );
    const r = (await res.json()) as { ok?: boolean; error?: string; version?: number; carpetas?: Record<string, boolean> };
    if (r.error === "No autorizado") return { titulo, ok: false, detalle: "APPS_SCRIPT_SECRET no coincide con el SECRET del script." };
    if ((r.version ?? 1) < 2) {
      return { titulo, ok: false, detalle: "El script publicado es la versión 1: falta pegar la versión 3 y publicar una versión nueva de la implementación." };
    }
    const faltan = Object.entries(CARPETAS)
      .filter(([clave]) => !r.carpetas?.[clave])
      .map(([, nombre]) => nombre);
    if (faltan.length > 0) return { titulo, ok: false, detalle: `Versión ${r.version}, pero faltan carpetas en las propiedades del script: ${faltan.join(", ")}.` };
    if ((r.version ?? 1) < 3) {
      return { titulo, ok: true, detalle: "Versión 2, con las cuatro carpetas configuradas. Para los accesos a Drive del panel, falta publicar la versión 3 (apps-script/README.md)." };
    }
    return { titulo, ok: true, detalle: `Versión ${r.version}, con las cuatro carpetas configuradas.` };
  } catch (e) {
    return { titulo, ok: false, detalle: `No se pudo hablar con el script: ${mensaje(e)}` };
  }
}

async function telegram(origin: string): Promise<Chequeo> {
  const titulo = "Bot de Telegram";
  const token = tokenTelegram();
  if (!token) return { titulo, ok: false, detalle: "Falta TELEGRAM_API_KEY." };
  try {
    const telegram = new TelegramApi(token);
    const [info, bot] = await conTiempo(Promise.all([telegram.infoWebhook(), telegram.yo()]));
    if (info.url === `${origin}/api/telegram-webhook`) return { titulo, ok: true, detalle: `@${bot.username}, activo: los mensajes llegan a esta app.` };
    return { titulo, ok: false, detalle: `El token de @${bot.username} funciona, pero falta activarlo: pestaña "Subir", botón "Activar bot".` };
  } catch (e) {
    return { titulo, ok: false, detalle: `TELEGRAM_API_KEY no funciona: ${mensaje(e)}` };
  }
}

/** Revisa todo lo que necesita la app, sin cambiar nada. */
export async function chequearConfiguracion(origin: string): Promise<{ listo: boolean; chequeos: Chequeo[] }> {
  const [ia, hojas, archivos, bot] = await Promise.all([anthropic(), planillas(), drive(), telegram(origin)]);
  const chequeos = [ia, ...hojas, archivos, bot];
  // Telegram no es imprescindible: sin el bot se puede subir por la web.
  const listo = faltantesCola().length === 0 && chequeos.filter((c) => c.titulo !== "Bot de Telegram").every((c) => c.ok);
  return { listo, chequeos };
}
