import { JWT } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/**
 * Cliente de Google con la cuenta de servicio, o null si faltan las variables.
 *
 * GOOGLE_PRIVATE_KEY se carga tal como viene en el JSON de la clave, con los saltos
 * de línea escritos como \n: acá se convierten en saltos reales.
 */
export function googleClient(): JWT | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) return null;
  return new JWT({ email, key: key.replace(/\\n/g, "\n"), scopes: SCOPES });
}
