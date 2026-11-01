import "server-only";
import { allowedEmails } from "../auth/allowed";
import { CrmSinConfigurar } from "../crm/fuente";
import { esDelEquipo, persona } from "../equipo";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { accesoDe, COLUMNAS_USUARIOS, filaDeUsuario, SUPER_ADMIN, usuarioDeFila, type Acceso, type ConfigUsuario } from "./modelo";

/** La configuración de los usuarios vive en la planilla del CRM, pestaña "Usuarios" (se crea sola). */
function pestania() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Los permisos no se pueden leer: falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return new PestaniaSimple(client, sheet, "Usuarios", COLUMNAS_USUARIOS);
}

// Se lee en cada página y cada pedido de datos: se guarda un minuto. Si la planilla falla, sirve
// lo último leído (si nunca se leyó, falla: mejor no mostrar que mostrar de más).
let cache: { hasta: number; valor: ConfigUsuario[] } | null = null;
let pedido: Promise<ConfigUsuario[]> | null = null;

export async function leerConfigs(fresco = false): Promise<ConfigUsuario[]> {
  if (!fresco && cache && cache.hasta > Date.now()) return cache.valor;
  let t: ReturnType<typeof pestania>;
  try {
    t = pestania();
  } catch (e) {
    // Sin planilla configurada no hay nadie configurado (cada uno queda con lo de por defecto).
    if (e instanceof CrmSinConfigurar) return [];
    throw e;
  }
  pedido ??= t
    .filas()
    .then((f) => {
      const valor = f.filter((x) => x[0]).map(usuarioDeFila);
      cache = { hasta: Date.now() + 60_000, valor };
      return valor;
    })
    .catch((e) => {
      if (cache) return cache.valor;
      throw e;
    })
    .finally(() => {
      pedido = null;
    });
  return pedido;
}

/** Lo que puede ver un usuario. El super administrador no depende de la planilla. */
export async function accesoDeEmail(email: string): Promise<Acceso> {
  const e = email.trim().toLowerCase();
  if (e === SUPER_ADMIN) return accesoDe(e, undefined, true);
  const configs = await leerConfigs();
  return accesoDe(e, configs.find((c) => c.email === e), esDelEquipo(e));
}

/** Los usuarios del sistema (los mails habilitados) con su configuración, para Ajustes y las menciones. */
export async function usuariosConfigurados(): Promise<{ email: string; config: ConfigUsuario | null; acceso: Acceso; apodo: string; nombre: string }[]> {
  const configs = await leerConfigs().catch(() => [] as ConfigUsuario[]);
  return [...allowedEmails()].map((email) => {
    const config = configs.find((c) => c.email === email) ?? null;
    const p = persona(email);
    return {
      email,
      config,
      acceso: accesoDe(email, config ?? undefined, esDelEquipo(email)),
      apodo: config?.usuario || p.apodo,
      nombre: config ? [config.nombre, config.apellido].filter(Boolean).join(" ") || p.nombre : p.nombre,
    };
  });
}

/** Guarda la configuración de un usuario (reemplaza su fila o agrega una). */
export async function guardarConfig(c: ConfigUsuario): Promise<void> {
  const t = pestania();
  const filas = await t.filas();
  const i = filas.findIndex((f) => (f[0] ?? "").trim().toLowerCase() === c.email);
  if (i >= 0) await t.escribir(i + 2, filaDeUsuario(c));
  else await t.agregar(filaDeUsuario(c));
  cache = null;
}
