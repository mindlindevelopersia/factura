import "server-only";
import { NextResponse } from "next/server";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { extractInvoice } from "../invoice/extract";
import { planillaDesdeEnv } from "../sheets/planilla";
import { almacenDesdeEnv, ScriptDesactualizado } from "../storage/archivos";
import { TelegramApi, tokenTelegram } from "../telegram/api";
import { textoAviso } from "../telegram/mensajes";
import { COLUMNAS_USUARIOS_TELEGRAM, UsuariosTelegram } from "../telegram/usuarios";
import { ColaSheets } from "./hoja";
import { COLUMNAS_COLA } from "./item";
import { ErrorCola, type Servicios } from "./servicio";

/** Lo que falta configurar para usar la cola, con el nombre de cada variable. */
export function faltantesCola(): string[] {
  const faltan: string[] = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) faltan.push("GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY");
  if (!process.env.COLA_SHEET_ID) faltan.push("COLA_SHEET_ID");
  if (!process.env.APPS_SCRIPT_URL || !process.env.APPS_SCRIPT_SECRET) faltan.push("APPS_SCRIPT_URL y APPS_SCRIPT_SECRET");
  return faltan;
}

function pestaniaCola(nombre: string, columnas: readonly string[]): PestaniaSimple {
  return new PestaniaSimple(googleClient()!, process.env.COLA_SHEET_ID!, nombre, columnas);
}

/**
 * Los servicios de la cola con la configuración del entorno. appUrl es la dirección de la
 * app, para los links de los avisos. Si falta configuración, tira un ErrorCola 503.
 */
export function serviciosDesdeEnv(appUrl: string): Servicios {
  const faltan = faltantesCola();
  if (faltan.length > 0) throw new ErrorCola(`Falta configurar en el servidor: ${faltan.join(", ")}.`, 503);
  const token = tokenTelegram();
  const telegram = token ? new TelegramApi(token) : null;
  return {
    cola: new ColaSheets(pestaniaCola(process.env.COLA_TAB || "Cola", COLUMNAS_COLA)),
    almacen: almacenDesdeEnv()!,
    planilla: planillaDesdeEnv(),
    extraer: (archivo, contexto) => {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta configurar ANTHROPIC_API_KEY en el servidor.");
      return extractInvoice(archivo, { comentario: contexto?.comentario });
    },
    avisar: telegram
      ? async (item, aviso, extra) => {
          if (!item.telegram) return;
          await telegram.enviar(item.telegram.chat, textoAviso(item, aviso, appUrl, extra), item.telegram.mensaje);
        }
      : undefined,
  };
}

/** Las cuentas de Telegram conectadas, en la pestaña "Telegram" de la planilla de la cola. */
export function usuariosTelegramDesdeEnv(): UsuariosTelegram {
  const faltan = faltantesCola();
  if (faltan.length > 0) throw new ErrorCola(`Falta configurar en el servidor: ${faltan.join(", ")}.`, 503);
  return new UsuariosTelegram(pestaniaCola(process.env.COLA_TAB_TELEGRAM || "Telegram", COLUMNAS_USUARIOS_TELEGRAM));
}

/** La respuesta para un error de una ruta de la cola. */
export function respuestaDeError(e: unknown): NextResponse {
  if (e instanceof ErrorCola) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ScriptDesactualizado) return NextResponse.json({ error: e.message }, { status: 503 });
  console.error(e);
  const detalle = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: `Algo falló en el servidor: ${detalle}` }, { status: 500 });
}
