import { JWT } from "google-auth-library";
import { conReintentos } from "./reintentos";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/**
 * Cliente de Google con la cuenta de servicio, o null si faltan las variables.
 *
 * GOOGLE_PRIVATE_KEY se carga tal como viene en el JSON de la clave, con los saltos
 * de línea escritos como \n: acá se convierten en saltos reales.
 *
 * Cada pedido se reintenta si Google responde que se agotó la cuota (con varias personas
 * con la web abierta y el bot recibiendo facturas, pasa) o, si es una lectura o una
 * escritura de un rango fijo, si falla la red o el servidor (ver reintentos.ts).
 */
export function googleClient(): JWT | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) return null;
  const client = new JWT({ email, key: key.replace(/\\n/g, "\n"), scopes: SCOPES });
  const pedir = client.request.bind(client) as (opts: { method?: string }) => Promise<unknown>;
  client.request = ((opts: { method?: string }) => {
    const metodo = (opts.method ?? "GET").toUpperCase();
    return conReintentos(() => pedir(opts), metodo === "GET" || metodo === "PUT");
  }) as typeof client.request;
  return client;
}
